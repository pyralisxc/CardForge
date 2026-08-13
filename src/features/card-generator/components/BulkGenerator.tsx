"use client";

import type { CardSet } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { PackagePlus } from 'lucide-react';
import { extractTemplateFieldDefinitions } from '@/domain/templates';
import {
  buildInitialColumnMapping,
  autoMapRequiredFields,
  createBulkDisplayCards,
  createBulkExampleCsv,
  createBulkExampleJson,
  createBulkExampleStructuredText,
  createBulkFaceFieldDefinitions,
  createBulkPreview,
  getBulkGenerationBlockingIssues,
  getUnmappedRequiredFieldKeys,
  normalizeCsvHeaders,
  parseBulkDataSource,
  resolveDuplicateFieldMapping,
} from '@/features/card-generator/lib/bulkGeneration';
import { extractErrorMessage, withNextStep } from '@/shared/userFacingErrors';
import { ERROR_COPY } from '@/features/card-generator/lib/errorCopy';
import { BulkTemplateSetupPanel } from '@/features/card-generator/components/BulkTemplateSetupPanel';
import { BulkCsvInputPanel } from '@/features/card-generator/components/BulkCsvInputPanel';
import { BulkMappingReviewPanel } from '@/features/card-generator/components/BulkMappingReviewPanel';
import { BulkGenerateActionBar } from '@/features/card-generator/components/BulkGenerateActionBar';
import { BulkDataResolutionDialog } from '@/features/card-generator/components/BulkDataResolutionDialog';
import { useBulkExampleDownloads } from '@/features/card-generator/hooks/useBulkExampleDownloads';
import type { DisplayCard } from '@/domain/rendering';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  backingTemplate?: TCGCardTemplate | null;
  activeCardSet: CardSet;
  onCardsGenerated: (cards: DisplayCard[]) => void;
  selectedTemplateIdProp: string | null;
}

type SupportedFileType = 'auto';

export function BulkGenerator({
  templates,
  backingTemplate,
  activeCardSet,
  onCardsGenerated,
  selectedTemplateIdProp,
}: BulkGeneratorProps) {
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileType] = useState<SupportedFileType>('auto');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const [conflictFocusField, setConflictFocusField] = useState<string | null>(null);
  const [dataReviewOpen, setDataReviewOpen] = useState(false);
  const [dataReviewIssues, setDataReviewIssues] = useState<string[]>([]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateIdProp),
    [templates, selectedTemplateIdProp]
  );

  const fieldDefinitions = useMemo(
    () => (selectedTemplate ? extractTemplateFieldDefinitions(selectedTemplate) : []),
    [selectedTemplate]
  );

  const backingFieldDefinitions = useMemo(
    () => (backingTemplate ? extractTemplateFieldDefinitions(backingTemplate) : []),
    [backingTemplate]
  );

  const bulkFieldDefinitions = useMemo(
    () => createBulkFaceFieldDefinitions(
      fieldDefinitions.filter((field) => !field.isStaticBaseText),
      backingFieldDefinitions.filter((field) => !field.isStaticBaseText),
    ),
    [backingFieldDefinitions, fieldDefinitions]
  );

  const exampleCSV = useMemo(
    () => createBulkExampleCsv({ template: selectedTemplate, backingTemplate, fieldDefinitions: bulkFieldDefinitions }),
    [backingTemplate, bulkFieldDefinitions, selectedTemplate]
  );

  const exampleJSON = useMemo(
    () => createBulkExampleJson({ template: selectedTemplate, backingTemplate, fieldDefinitions: bulkFieldDefinitions }),
    [backingTemplate, bulkFieldDefinitions, selectedTemplate]
  );

  const exampleStructuredText = useMemo(
    () => createBulkExampleStructuredText({ template: selectedTemplate, backingTemplate, fieldDefinitions: bulkFieldDefinitions }),
    [backingTemplate, bulkFieldDefinitions, selectedTemplate]
  );
  const {
    handleDownloadExampleCsv,
    handleDownloadExampleJson,
    handleDownloadStructuredText,
  } = useBulkExampleDownloads({
    selectedTemplate,
    exampleCsv: exampleCSV,
    exampleJson: exampleJSON,
    exampleStructuredText,
    toast,
  });

  const parsedCsv = useMemo(() => {
    if (!bulkDataInput.trim() || !selectedTemplate) {
      return { rows: [] as string[][], error: null as string | null };
    }
    try {
      return { rows: parseBulkDataSource(bulkDataInput.trim(), selectedFileType), error: null as string | null };
    } catch (error) {
      return { rows: [] as string[][], error: extractErrorMessage(error) };
    }
  }, [bulkDataInput, selectedFileType, selectedTemplate]);

  const parsedRows = parsedCsv.rows;

  const mappedColumnCount = useMemo(
    () => csvHeaders.filter((header) => !!columnMapping[header]).length,
    [columnMapping, csvHeaders]
  );

  const requiredFieldKeySet = useMemo(
    () => new Set(bulkFieldDefinitions.filter((field) => field.required).map((field) => field.key)),
    [bulkFieldDefinitions]
  );

  const duplicateRequiredFieldCounts = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(columnMapping)
      .map((value) => value?.trim())
      .filter((value): value is string => !!value)
      .forEach((fieldKey) => {
        counts.set(fieldKey, (counts.get(fieldKey) ?? 0) + 1);
      });

    const duplicateCounts = new Map<string, number>();
    counts.forEach((count, fieldKey) => {
      if (count > 1 && requiredFieldKeySet.has(fieldKey)) {
        duplicateCounts.set(fieldKey, count);
      }
    });

    return duplicateCounts;
  }, [columnMapping, requiredFieldKeySet]);

  const duplicateRequiredFields = useMemo(
    () => Array.from(duplicateRequiredFieldCounts.keys()),
    [duplicateRequiredFieldCounts]
  );

  const unmappedRequiredFields = useMemo(
    () => getUnmappedRequiredFieldKeys(bulkFieldDefinitions, columnMapping),
    [bulkFieldDefinitions, columnMapping]
  );

  const blockingIssues = useMemo(() => {
    if (!selectedTemplate || !bulkDataInput.trim()) return [] as string[];
    if (parsedCsv.error) return [parsedCsv.error];
    return getBulkGenerationBlockingIssues(csvHeaders, parsedRows, columnMapping);
  }, [bulkDataInput, columnMapping, csvHeaders, parsedCsv.error, parsedRows, selectedTemplate]);

  const bulkPreview = useMemo(() => {
    if (!selectedTemplate) return { rows: [], globalWarnings: [] };
    return createBulkPreview({
      rows: parsedRows,
      columnMapping,
      fieldDefinitions: bulkFieldDefinitions,
      previewOverrides: {},
      maxPreviewRows: Math.min(parsedRows.length, 25),
    });
  }, [bulkFieldDefinitions, columnMapping, parsedRows, selectedTemplate]);

  const reviewIssues = useMemo(() => Array.from(new Set([
    ...blockingIssues,
    ...bulkPreview.globalWarnings,
    ...bulkPreview.rows.flatMap((row) => row.warnings.map((warning) => `Row ${row.rowNumber}: ${warning}`)),
  ])), [blockingIssues, bulkPreview.globalWarnings, bulkPreview.rows]);

  const openDataReview = useCallback((issues = reviewIssues) => {
    setDataReviewIssues(issues.length > 0 ? issues : ['We could not read this data source. Check the file format and field names.']);
    setDataReviewOpen(true);
  }, [reviewIssues]);

  const visibleCsvHeaders = useMemo(() => {
    let headers = csvHeaders;
    if (showUnmappedOnly) {
      headers = headers.filter((header) => !columnMapping[header]);
    }
    if (conflictFocusField) {
      headers = headers.filter((header) => columnMapping[header] === conflictFocusField);
    }
    return headers;
  }, [columnMapping, conflictFocusField, csvHeaders, showUnmappedOnly]);

  useEffect(() => {
    if (!bulkDataInput.trim() || !selectedTemplate) {
      setCsvHeaders([]);
      setColumnMapping({});
      return;
    }
    try {
      const rows = parseBulkDataSource(bulkDataInput.trim(), selectedFileType);
      if (rows.length < 1) return;
      const headers = normalizeCsvHeaders(rows[0]);
      setCsvHeaders(headers);
      setColumnMapping(buildInitialColumnMapping(headers, bulkFieldDefinitions));
    } catch {
      setCsvHeaders([]);
      setColumnMapping({});
    }
  }, [bulkDataInput, selectedFileType, selectedTemplate, bulkFieldDefinitions]);

  useEffect(() => {
    setShowAdvancedMapping(false);
    setShowUnmappedOnly(false);
    setConflictFocusField(null);
  }, [backingTemplate?.id, bulkDataInput, selectedTemplateIdProp]);

  useEffect(() => {
    if (!conflictFocusField) return;
    if (!duplicateRequiredFieldCounts.has(conflictFocusField)) {
      setConflictFocusField(null);
    }
  }, [conflictFocusField, duplicateRequiredFieldCounts]);

  const handleAutoMapAgain = useCallback(() => {
    if (csvHeaders.length === 0 || bulkFieldDefinitions.length === 0) return;
    setColumnMapping(buildInitialColumnMapping(csvHeaders, bulkFieldDefinitions));
    toast({
      title: 'Auto-mapping refreshed',
      description: 'Column mappings were rebuilt from CSV headers. Next step: review mapping conflicts before generating.',
    });
  }, [bulkFieldDefinitions, csvHeaders, toast]);

  const handleAutoMapRequiredFields = useCallback(() => {
    if (csvHeaders.length === 0 || bulkFieldDefinitions.length === 0) return;
    const nextMapping = autoMapRequiredFields(csvHeaders, bulkFieldDefinitions, columnMapping);
    const resolvedCount = unmappedRequiredFields.length - getUnmappedRequiredFieldKeys(bulkFieldDefinitions, nextMapping).length;
    setColumnMapping(nextMapping);
    toast({
      title: resolvedCount > 0 ? 'Required fields mapped' : 'No matching headers found',
      description: resolvedCount > 0
        ? `${resolvedCount} required field${resolvedCount === 1 ? '' : 's'} matched by header name.`
        : 'Rename columns to match field keys or labels, or map them manually.',
    });
  }, [bulkFieldDefinitions, columnMapping, csvHeaders, toast, unmappedRequiredFields.length]);

  const handleResolveDuplicateRequiredField = useCallback((fieldKey: string) => {
    setColumnMapping((current) => resolveDuplicateFieldMapping(current, fieldKey));
    setConflictFocusField(null);
    const fieldLabel = bulkFieldDefinitions.find((field) => field.key === fieldKey)?.label ?? fieldKey;
    toast({
      title: 'Duplicate mapping resolved',
      description: `${fieldLabel} now keeps its first mapped column and ignores extra duplicates.`,
    });
  }, [bulkFieldDefinitions, toast]);

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({
        title: ERROR_COPY.selectTemplateFirst.title,
        description: withNextStep('Choose a card design before adding cards from a list.', 'Choose a card design above, then try again.'),
        variant: 'destructive',
      });
      return;
    }
    if (!bulkDataInput.trim()) {
      toast({
        title: ERROR_COPY.csvRequired.title,
        description: withNextStep('No card list was found.', 'Paste your list or upload a file, then try again.'),
        variant: 'destructive',
      });
      return;
    }
    if (reviewIssues.length > 0) {
      toast({
        title: 'We found something to fix',
        description: reviewIssues[0],
        variant: 'destructive',
      });
      openDataReview();
      return;
    }

    setIsLoading(true);
    try {
      const rows = parseBulkDataSource(bulkDataInput.trim(), selectedFileType);
      if (rows.length < 2) {
        toast({
          title: ERROR_COPY.csvFormatIncomplete.title,
          description: withNextStep('A header row and at least one card are required.', 'Check your CSV format or download an example CSV file and try again.'),
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const generatedCards = createBulkDisplayCards({
        template: selectedTemplate,
        backingTemplate,
        activeCardSet,
        fieldDefinitions,
        backingFieldDefinitions,
        rows,
        columnMapping,
        previewOverrides: {},
      });

      onCardsGenerated(generatedCards);
      if (generatedCards.length > 0) {
        toast({ title: 'Cards added to your set', description: `${generatedCards.length} cards are ready to review, edit, or download.` });
      } else {
        toast({
        title: 'No cards were added',
          description: withNextStep('No rows produced a card.', 'Check your details and card-field matches, then try again.'),
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error generating outputs:', error);
      toast({
      title: 'Cards could not be added',
        description: withNextStep(extractErrorMessage(error), 'Review your list and card-field matches, then try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataInputChange = (value: string) => {
    setBulkDataInput(value);
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!/\.(csv|json|txt|md)$/i.test(file.name)) {
        toast({
          title: ERROR_COPY.unsupportedFileType.title,
          description: withNextStep('Only .csv, .json, .txt, and .md files are supported for data import.', 'Choose a supported data file and upload again.'),
          variant: 'destructive',
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const text = loadEvent.target?.result as string;
        setBulkDataInput(text);
        try {
          const rows = parseBulkDataSource(text.trim(), selectedFileType);
          const headers = normalizeCsvHeaders(rows[0] || []);
          const mapping = buildInitialColumnMapping(headers, bulkFieldDefinitions);
          const preview = createBulkPreview({
            rows,
            columnMapping: mapping,
            fieldDefinitions: bulkFieldDefinitions,
            previewOverrides: {},
            maxPreviewRows: Math.min(rows.length, 25),
          });
          const issues = [
            ...getBulkGenerationBlockingIssues(headers, rows, mapping),
            ...preview.globalWarnings,
            ...preview.rows.flatMap((row) => row.warnings.map((warning) => `Row ${row.rowNumber}: ${warning}`)),
          ];
          if (issues.length > 0) {
            openDataReview(issues);
          } else {
            toast({ title: 'Data ready', description: `${Math.max(0, rows.length - 1)} card${rows.length === 2 ? '' : 's'} are ready to generate.` });
          }
        } catch {
          openDataReview();
        }
      };
      reader.onerror = () => {
        toast({
          title: ERROR_COPY.fileReadError.title,
          description: withNextStep(`Unable to read ${file.name}.`, 'Check file encoding or re-save as UTF-8 text, then retry.'),
          variant: 'destructive',
        });
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Make cards from a list</CardTitle>
        <CardDescription>Choose a card design, add your data, and generate cards you can edit individually.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <BulkTemplateSetupPanel
          selectedTemplateId={selectedTemplateIdProp}
          selectedTemplate={selectedTemplate}
          backingTemplate={backingTemplate}
          bulkFieldDefinitions={bulkFieldDefinitions}
          onDownloadExampleCsv={handleDownloadExampleCsv}
          onDownloadExampleJson={handleDownloadExampleJson}
          onDownloadStructuredText={handleDownloadStructuredText}
        />

        <BulkCsvInputPanel
          selectedTemplateId={selectedTemplateIdProp}
          selectedTemplate={selectedTemplate}
          bulkDataInput={bulkDataInput}
          exampleCsv={exampleCSV}
          exampleJson={exampleJSON}
          exampleStructuredText={exampleStructuredText}
          bulkFieldDefinitions={bulkFieldDefinitions}
          fileInputRef={fileInputRef}
          onDataInputChange={handleDataInputChange}
          onFileUpload={handleFileUpload}
        />

        {bulkDataInput.trim() ? (
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm ${reviewIssues.length > 0 ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
            <span>{reviewIssues.length > 0 ? `We found ${reviewIssues.length} thing${reviewIssues.length === 1 ? '' : 's'} to fix.` : `CardForge is ready to make ${Math.max(0, parsedRows.length - 1)} card${parsedRows.length === 2 ? '' : 's'}.`}</span>
            {reviewIssues.length > 0 ? <button type="button" className="font-medium underline" onClick={() => openDataReview()}>Review data</button> : null}
          </div>
        ) : null}

        {dataReviewOpen ? (
          <BulkDataResolutionDialog open issues={dataReviewIssues} onOpenChange={setDataReviewOpen}>
          {csvHeaders.length > 0 && selectedTemplate ? (
            <BulkMappingReviewPanel
              headers={csvHeaders}
              visibleHeaders={visibleCsvHeaders}
              columnMapping={columnMapping}
              fieldDefinitions={bulkFieldDefinitions}
              mappedColumnCount={mappedColumnCount}
              showAdvancedMapping={showAdvancedMapping}
              showUnmappedOnly={showUnmappedOnly}
              conflictFocusField={conflictFocusField}
              duplicateRequiredFields={duplicateRequiredFields}
              duplicateRequiredFieldCounts={duplicateRequiredFieldCounts}
              unmappedRequiredFields={unmappedRequiredFields}
              onToggleAdvancedMapping={() => setShowAdvancedMapping((prev) => !prev)}
              onAutoMapAgain={handleAutoMapAgain}
              onAutoMapRequiredFields={handleAutoMapRequiredFields}
              onToggleShowUnmappedOnly={() => setShowUnmappedOnly((prev) => !prev)}
              onSetConflictFocusField={setConflictFocusField}
              onResolveDuplicateRequiredField={handleResolveDuplicateRequiredField}
              onColumnMappingChange={setColumnMapping}
            />
          ) : null}
          </BulkDataResolutionDialog>
        ) : null}

        <BulkGenerateActionBar
          isLoading={isLoading}
          disabled={isLoading || !selectedTemplateIdProp || !bulkDataInput.trim() || reviewIssues.length > 0}
          helperText={reviewIssues[0]}
          onGenerate={handleGenerate}
        />
      </CardContent>
    </Card>
  );
}
