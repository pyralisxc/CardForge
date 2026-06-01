"use client";

import type { TCGCardTemplate, DisplayCard } from '@/types';
import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PackagePlus } from 'lucide-react';
import { extractTemplateFieldDefinitions } from '@/lib/templateFields';
import {
  buildInitialColumnMapping,
  createBulkDisplayCards,
  createBulkExampleCsv,
  createBulkExampleJson,
  createBulkImportContract,
  createBulkPreview,
  getBulkGenerationBlockingIssues,
  normalizeCsvHeaders,
  parseBulkDataSource,
  shouldBlockBulkGeneration,
} from '@/lib/bulkGeneration';
import { extractErrorMessage, withNextStep } from '@/lib/userFacingErrors';
import { ERROR_COPY } from '@/lib/errorCopy';
import { useAppStore } from '@/store/appStore';
import { BulkTemplateSetupPanel } from '@/features/card-generator/components/BulkTemplateSetupPanel';
import { BulkCsvInputPanel } from '@/features/card-generator/components/BulkCsvInputPanel';
import { BulkMappingReviewPanel } from '@/features/card-generator/components/BulkMappingReviewPanel';
import { BulkPreviewValidationPanel } from '@/features/card-generator/components/BulkPreviewValidationPanel';
import { BulkGenerateActionBar } from '@/features/card-generator/components/BulkGenerateActionBar';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  onCardsGenerated: (cards: DisplayCard[]) => void;
  selectedTemplateIdProp: string | null;
  onTemplateSelectionChange: (templateId: string | null) => void;
}

type PreviewFilter = 'all' | 'warnings' | 'clean';
type SupportedFileType = 'auto';

export function BulkGenerator({
  templates,
  onCardsGenerated,
  selectedTemplateIdProp,
  onTemplateSelectionChange,
}: BulkGeneratorProps) {
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileType] = useState<SupportedFileType>('auto');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewOverrides, setPreviewOverrides] = useState<Record<number, Record<string, string>>>({});
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const [conflictFocusField, setConflictFocusField] = useState<string | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const richTextHighlightColor = useAppStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useAppStore((state) => state.setRichTextHighlightColor);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateIdProp),
    [templates, selectedTemplateIdProp]
  );

  const fieldDefinitions = useMemo(
    () => (selectedTemplate ? extractTemplateFieldDefinitions(selectedTemplate) : []),
    [selectedTemplate]
  );

  const bulkFieldDefinitions = useMemo(
    () => fieldDefinitions.filter((field) => !field.isStaticBaseText),
    [fieldDefinitions]
  );

  const fieldDefinitionMap = useMemo(
    () => new Map(bulkFieldDefinitions.map((field) => [field.key, field])),
    [bulkFieldDefinitions]
  );

  const exampleCSV = useMemo(
    () => createBulkExampleCsv({ template: selectedTemplate, fieldDefinitions: bulkFieldDefinitions }),
    [bulkFieldDefinitions, selectedTemplate]
  );

  const exampleJSON = useMemo(
    () => createBulkExampleJson({ template: selectedTemplate, fieldDefinitions: bulkFieldDefinitions }),
    [bulkFieldDefinitions, selectedTemplate]
  );

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

  const bulkPreview = useMemo(() => {
    if (!selectedTemplate) return { rows: [], globalWarnings: [] };
    return createBulkPreview({
      rows: parsedRows,
      columnMapping,
      fieldDefinitions: bulkFieldDefinitions,
      previewOverrides,
    });
  }, [bulkFieldDefinitions, columnMapping, parsedRows, previewOverrides, selectedTemplate]);

  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === 'warnings') {
      return bulkPreview.rows.filter((row) => row.warnings.length > 0);
    }
    if (previewFilter === 'clean') {
      return bulkPreview.rows.filter((row) => row.warnings.length === 0);
    }
    return bulkPreview.rows;
  }, [bulkPreview.rows, previewFilter]);

  const previewWarningCount = useMemo(
    () => bulkPreview.rows.reduce((count, row) => count + row.warnings.length, 0),
    [bulkPreview.rows]
  );

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

  const blockingIssues = useMemo(() => {
    if (!selectedTemplate || !bulkDataInput.trim()) return [] as string[];
    if (parsedCsv.error) return [parsedCsv.error];
    return getBulkGenerationBlockingIssues(csvHeaders, parsedRows, columnMapping);
  }, [bulkDataInput, columnMapping, csvHeaders, parsedCsv.error, parsedRows, selectedTemplate]);

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

  const hasBlockingWarnings = shouldBlockBulkGeneration(
    strictMode,
    bulkPreview.globalWarnings.length,
    previewWarningCount
  );

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
      const keys = bulkFieldDefinitions.map((field) => field.key);
      setColumnMapping(buildInitialColumnMapping(headers, keys));
    } catch {
      setCsvHeaders([]);
      setColumnMapping({});
    }
  }, [bulkDataInput, selectedFileType, selectedTemplate, bulkFieldDefinitions]);

  useEffect(() => {
    setPreviewOverrides({});
    setPreviewFilter('all');
    setShowAdvancedMapping(false);
    setShowUnmappedOnly(false);
    setConflictFocusField(null);
  }, [bulkDataInput, selectedTemplateIdProp]);

  useEffect(() => {
    if (!conflictFocusField) return;
    if (!duplicateRequiredFieldCounts.has(conflictFocusField)) {
      setConflictFocusField(null);
    }
  }, [conflictFocusField, duplicateRequiredFieldCounts]);

  const handleAutoMapAgain = useCallback(() => {
    if (csvHeaders.length === 0 || bulkFieldDefinitions.length === 0) return;
    const keys = bulkFieldDefinitions.map((field) => field.key);
    setColumnMapping(buildInitialColumnMapping(csvHeaders, keys));
    toast({
      title: 'Auto-mapping refreshed',
      description: 'Column mappings were rebuilt from CSV headers. Next step: review mapping conflicts before generating.',
    });
  }, [bulkFieldDefinitions, csvHeaders, toast]);

  const applyPreviewOverride = useCallback((rowNumber: number, fieldKey: string, value: string) => {
    setPreviewOverrides((previous) => ({
      ...previous,
      [rowNumber]: {
        ...(previous[rowNumber] || {}),
        [fieldKey]: value,
      },
    }));
  }, []);

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({
        title: ERROR_COPY.selectTemplateFirst.title,
        description: withNextStep('Bulk generation requires a selected template.', 'Pick a template in step 1, then generate again.'),
        variant: 'destructive',
      });
      return;
    }
    if (!bulkDataInput.trim()) {
      toast({
        title: ERROR_COPY.csvRequired.title,
        description: withNextStep('No CSV data was found.', 'Paste CSV content or upload a .csv file, then generate again.'),
        variant: 'destructive',
      });
      return;
    }
    if (blockingIssues.length > 0) {
      toast({
        title: 'Bulk generation blocked',
        description: withNextStep(blockingIssues[0], 'Fix the blocking CSV issue in Preview & Validation, then generate again.'),
        variant: 'destructive',
      });
      return;
    }
    if (hasBlockingWarnings) {
      toast({
        title: ERROR_COPY.strictModeBlocked.title,
        description: withNextStep('Warnings are still present in mapping or required fields.', 'Use Preview & Validation quick fixes, or disable Strict Mode to continue.'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const rows = parseBulkDataSource(bulkDataInput.trim(), selectedFileType);
      if (rows.length < 2) {
        toast({
          title: ERROR_COPY.csvFormatIncomplete.title,
          description: withNextStep('A header row and at least one data row are required.', 'Check your CSV format or download the example CSV template and try again.'),
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const generatedCards = createBulkDisplayCards({
        template: selectedTemplate,
        fieldDefinitions,
        rows,
        columnMapping,
        previewOverrides,
      });

      onCardsGenerated(generatedCards);
      if (generatedCards.length > 0) {
        toast({ title: 'Bulk generation complete', description: `${generatedCards.length} outputs were added. Next step: review outputs and export.` });
      } else {
        toast({
        title: 'No outputs were generated',
          description: withNextStep('No rows produced card output.', 'Check column mapping and row data in Preview & Validation, then try again.'),
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error generating outputs:', error);
      toast({
        title: 'Bulk generation failed',
        description: withNextStep(extractErrorMessage(error), 'Review data structure and mapped fields, then retry.'),
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
      if (!/\.(csv|json|txt)$/i.test(file.name)) {
        toast({
          title: ERROR_COPY.unsupportedFileType.title,
          description: withNextStep('Only .csv, .json, and .txt files are supported for data import.', 'Choose a supported data file and upload again.'),
          variant: 'destructive',
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const text = loadEvent.target?.result as string;
        setBulkDataInput(text);
        toast({ title: 'Data source loaded', description: `Loaded ${file.name}. Next step: review mapping and generate outputs.` });
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

  const handleDownloadTemplateCSV = () => {
    if (!selectedTemplate) {
      toast({
        title: ERROR_COPY.selectTemplateFirst.title,
        description: withNextStep('A template is required before downloading example CSV.', 'Choose a template in step 1 and try again.'),
        variant: 'default',
      });
      return;
    }
    const csvContent = exampleCSV;
    if (!csvContent.trim() || !csvContent.includes('\n') || csvContent.startsWith('Select a template first.')) {
      toast({
        title: 'Example CSV unavailable',
        description: withNextStep('The selected template has no usable placeholder fields.', 'Add placeholders in Layout Studio, save, then download again.'),
        variant: 'destructive',
      });
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const safeTemplateName = selectedTemplate.name.replace(/[^a-z0-9_]/gi, '_').substring(0, 20);
    const fileName = `template_${safeTemplateName}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Example CSV downloaded', description: `${fileName} is ready. Next step: fill it with your data and upload.` });
  };

  const handleDownloadTemplateJSON = () => {
    if (!selectedTemplate) {
      toast({
        title: ERROR_COPY.selectTemplateFirst.title,
        description: withNextStep('A template is required before downloading example JSON.', 'Choose a template in step 1 and try again.'),
        variant: 'default',
      });
      return;
    }
    if (!exampleJSON.trim() || exampleJSON === '[]') {
      toast({
        title: 'Example JSON unavailable',
        description: withNextStep('The selected template has no usable placeholder fields.', 'Add placeholders in Layout Studio, save, then download again.'),
        variant: 'destructive',
      });
      return;
    }

    const blob = new Blob([exampleJSON], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const safeTemplateName = selectedTemplate.name.replace(/[^a-z0-9_]/gi, '_').substring(0, 20);
    const fileName = `template_${safeTemplateName || 'layout'}.json`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Example JSON downloaded', description: `${fileName} is ready. Next step: fill it with your data and upload.` });
  };

  const handleDownloadContractJson = useCallback(() => {
    if (!selectedTemplate) {
      toast({
        title: ERROR_COPY.selectTemplateFirst.title,
        description: withNextStep('A template is required before downloading contract JSON.', 'Choose a template in step 1 and try again.'),
        variant: 'default',
      });
      return;
    }

    const contract = createBulkImportContract({
      template: selectedTemplate,
      fieldDefinitions: bulkFieldDefinitions,
    });

    const blob = new Blob([JSON.stringify(contract, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTemplateName = selectedTemplate.name.replace(/[^a-z0-9_]/gi, '_').substring(0, 20);
    link.href = url;
    link.download = `contract_${safeTemplateName || 'template'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Contract JSON downloaded', description: 'Use this contract as the source of truth for bulk validation and external pipelines.' });
  }, [bulkFieldDefinitions, selectedTemplate, toast]);

  const handleTemplateSelectChange = useCallback((id: string | null) => {
    onTemplateSelectionChange(id);
    setBulkDataInput('');
  }, [onTemplateSelectionChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Bulk Import</CardTitle>
        <CardDescription>Run a contract-driven data workflow with mapping, preview, validation, and export-ready output.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <BulkTemplateSetupPanel
          templates={templates}
          selectedTemplateId={selectedTemplateIdProp}
          selectedTemplate={selectedTemplate}
          bulkFieldDefinitions={bulkFieldDefinitions}
          onTemplateSelectionChange={handleTemplateSelectChange}
          onDownloadExampleCsv={handleDownloadTemplateCSV}
          onDownloadExampleJson={handleDownloadTemplateJSON}
          onDownloadContractJson={handleDownloadContractJson}
        />

        <BulkCsvInputPanel
          selectedTemplateId={selectedTemplateIdProp}
          selectedTemplate={selectedTemplate}
          bulkDataInput={bulkDataInput}
          exampleCsv={exampleCSV}
          bulkFieldDefinitions={bulkFieldDefinitions}
          fileInputRef={fileInputRef}
          onDataInputChange={handleDataInputChange}
          onFileUpload={handleFileUpload}
        />

        {csvHeaders.length > 0 && selectedTemplate && (
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
            onToggleAdvancedMapping={() => setShowAdvancedMapping((prev) => !prev)}
            onAutoMapAgain={handleAutoMapAgain}
            onToggleShowUnmappedOnly={() => setShowUnmappedOnly((prev) => !prev)}
            onSetConflictFocusField={setConflictFocusField}
            onColumnMappingChange={setColumnMapping}
          />
        )}

        <BulkPreviewValidationPanel
          rows={bulkPreview.rows}
          filteredRows={filteredPreviewRows}
          blockingIssues={blockingIssues}
          globalWarnings={bulkPreview.globalWarnings}
          previewFilter={previewFilter}
          previewWarningCount={previewWarningCount}
          strictMode={strictMode}
          hasBlockingWarnings={hasBlockingWarnings}
          fieldDefinitionMap={fieldDefinitionMap}
          richTextHighlightColor={richTextHighlightColor}
          onSetPreviewFilter={setPreviewFilter}
          onApplyPreviewOverride={applyPreviewOverride}
          onSetRichTextHighlightColor={setRichTextHighlightColorAction}
          onSetStrictMode={setStrictMode}
        />

        <BulkGenerateActionBar
          isLoading={isLoading}
          disabled={isLoading || !selectedTemplateIdProp || !bulkDataInput.trim() || hasBlockingWarnings || blockingIssues.length > 0}
          helperText={blockingIssues[0] ?? (hasBlockingWarnings ? 'Strict Mode is blocking generation until warnings are resolved.' : undefined)}
          onGenerate={handleGenerate}
        />
      </CardContent>
    </Card>
  );
}
