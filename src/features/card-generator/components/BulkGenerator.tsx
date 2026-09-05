"use client";

import type { CardSet } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, Download, FileJson, FileText, PackagePlus, Plus } from 'lucide-react';
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
import { BulkCsvInputPanel } from '@/features/card-generator/components/BulkCsvInputPanel';
import { BulkMappingReviewPanel } from '@/features/card-generator/components/BulkMappingReviewPanel';
import { BulkGenerateActionBar } from '@/features/card-generator/components/BulkGenerateActionBar';
import { BulkDataResolutionDialog } from '@/features/card-generator/components/BulkDataResolutionDialog';
import { useBulkExampleDownloads } from '@/features/card-generator/hooks/useBulkExampleDownloads';
import type { DisplayCard } from '@/domain/rendering';
import { buildBulkRevisionPlan, type BulkRevisionMatch, type BulkRevisionPlan } from '@/features/card-generator/lib/bulkRevision';
import { trackCardForgeEvent } from '@/features/analytics/client/tracking';
import { BulkRevisionLibraryPicker } from '@/features/card-generator/components/BulkRevisionLibraryPicker';

interface BulkGeneratorProps {
  onDirtyChange?: (dirty: boolean) => void;
  templates: TCGCardTemplate[];
  backingTemplate?: TCGCardTemplate | null;
  activeCardSet: CardSet;
  onCardsGenerated: (cards: DisplayCard[]) => void;
  currentCards: DisplayCard[];
  onCardsRevised: (cards: DisplayCard[]) => number;
  onUndoRevision: () => number;
  onViewGeneratedCards: (cards: DisplayCard[]) => void;
  selectedTemplateIdProp: string | null;
  revisionScopeIds?: readonly string[];
}

const EMPTY_REVISION_SCOPE: readonly string[] = [];

type SupportedFileType = 'auto';

export function BulkGenerator({
  onDirtyChange,
  templates,
  backingTemplate,
  activeCardSet,
  onCardsGenerated,
  currentCards,
  onCardsRevised,
  onUndoRevision,
  onViewGeneratedCards,
  selectedTemplateIdProp,
  revisionScopeIds = EMPTY_REVISION_SCOPE,
}: BulkGeneratorProps) {
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [committedInput, setCommittedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileType] = useState<SupportedFileType>('auto');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const [conflictFocusField, setConflictFocusField] = useState<string | null>(null);
  const [dataReviewOpen, setDataReviewOpen] = useState(false);
  const [dataReviewIssues, setDataReviewIssues] = useState<string[]>([]);
  const [lastGeneratedCards, setLastGeneratedCards] = useState<DisplayCard[]>([]);
  const [operation, setOperation] = useState<'generate' | 'revise'>(revisionScopeIds.length ? 'revise' : 'generate');
  const [revisionMatchKey, setRevisionMatchKey] = useState<string>('unique-id');
  const [revisionResourceFieldKey, setRevisionResourceFieldKey] = useState<string>('');
  const [pendingRevision, setPendingRevision] = useState<BulkRevisionPlan | null>(null);
  const [lastRevisionCount, setLastRevisionCount] = useState(0);
  useEffect(() => {
    onDirtyChange?.(Boolean(pendingRevision) || (Boolean(bulkDataInput.trim()) && bulkDataInput !== committedInput));
  }, [bulkDataInput, committedInput, onDirtyChange, pendingRevision]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const revisionPreviewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!pendingRevision) return;
    const frame = requestAnimationFrame(() => revisionPreviewRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [pendingRevision]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateIdProp),
    [templates, selectedTemplateIdProp]
  );

  const fieldDefinitions = useMemo(
    () => (selectedTemplate ? extractTemplateFieldDefinitions(selectedTemplate) : []),
    [selectedTemplate]
  );
  const revisionImageFields = useMemo(
    () => fieldDefinitions.filter((field) => field.isImage && !field.isStaticBaseText),
    [fieldDefinitions],
  );
  const effectiveRevisionScopeIds = useMemo(() => {
    const existingIds = new Set(currentCards.map((card) => card.uniqueId));
    return [...new Set(revisionScopeIds)].filter((id) => existingIds.has(id));
  }, [currentCards, revisionScopeIds]);
  const requestedRevisionScopeCount = new Set(revisionScopeIds).size;
  const hasRequestedRevisionScope = requestedRevisionScopeCount > 0;
  const revisionScopeIsStale = hasRequestedRevisionScope
    && effectiveRevisionScopeIds.length !== requestedRevisionScopeCount;

  useEffect(() => {
    if (!revisionScopeIds.length) return;
    setOperation('revise');
    setPendingRevision(null);
  }, [revisionScopeIds]);

  useEffect(() => {
    setRevisionResourceFieldKey((current) => revisionImageFields.some((field) => field.key === current)
      ? current
      : revisionImageFields[0]?.key ?? '');
  }, [revisionImageFields]);

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
        description: withNextStep('Choose a Template before adding cards from a list.', 'Choose a Template above, then try again.'),
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
    if (operation === 'revise' && revisionScopeIsStale) {
      toast({
        title: 'Selected Artifacts changed',
        description: 'Return to the Desk and select the Artifacts again. CardForge will not widen a stale selection to the whole Set.',
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
        createId: operation === 'revise' && revisionMatchKey === 'unique-id'
          ? (rowNumber) => {
              const idColumn = normalizeCsvHeaders(rows[0]).findIndex((header) => /^(cardforge[ _-]?id|unique[ _-]?id)$/iu.test(header));
              return idColumn >= 0 ? String(rows[rowNumber - 1]?.[idColumn] ?? '').trim() : '';
            }
          : undefined,
      });

      if (operation === 'revise') {
        const match: BulkRevisionMatch = revisionMatchKey === 'unique-id'
          ? { kind: 'unique-id' }
          : { kind: 'field', key: revisionMatchKey, label: fieldDefinitions.find((field) => field.key === revisionMatchKey)?.label ?? revisionMatchKey };
        const plan = buildBulkRevisionPlan({
          existing: currentCards,
          incoming: generatedCards,
          match,
          scopeIds: hasRequestedRevisionScope ? effectiveRevisionScopeIds : undefined,
        });
        trackCardForgeEvent('revision_started', {
          object_kind: 'card',
          input_method: match.kind,
          count_bucket: plan.matchedCount === 0 ? '0' : plan.matchedCount <= 5 ? '1_5' : plan.matchedCount <= 20 ? '6_20' : '21_plus',
          outcome: plan.ambiguousRows.length > 0 ? 'ambiguous' : 'previewed',
        });
        setPendingRevision(plan);
        setIsLoading(false);
        return;
      }

      onCardsGenerated(generatedCards);
      setCommittedInput(bulkDataInput);
      if (generatedCards.length > 0) {
        setLastGeneratedCards(generatedCards);
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
    if (lastGeneratedCards.length > 0) setLastGeneratedCards([]);
    setPendingRevision(null);
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
    <section aria-labelledby="bulk-generator-heading" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="bulk-generator-heading" className="flex items-center gap-2 text-lg font-semibold"><PackagePlus className="h-5 w-5 text-primary" aria-hidden="true" />Add card data</h3>
          <p className="mt-1 text-sm text-muted-foreground">Paste a simple list, upload a file, or start from a CardForge example.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" disabled={!selectedTemplate}><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download starter</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadStructuredText}><FileText className="mr-2 h-4 w-4" aria-hidden="true" />Text / Markdown</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadExampleCsv}><Download className="mr-2 h-4 w-4" aria-hidden="true" />CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadExampleJson}><FileJson className="mr-2 h-4 w-4" aria-hidden="true" />JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <div className="inline-flex rounded-md border border-[var(--cf-border)] p-1" role="group" aria-label="Bulk operation">
          <Button type="button" size="sm" aria-pressed={operation === 'generate'} variant={operation === 'generate' ? 'default' : 'ghost'} onClick={() => { setOperation('generate'); setPendingRevision(null); }}>Generate</Button>
          <Button type="button" size="sm" aria-pressed={operation === 'revise'} variant={operation === 'revise' ? 'default' : 'ghost'} disabled={currentCards.length === 0} onClick={() => { setOperation('revise'); setPendingRevision(null); }}>Revise existing</Button>
        </div>
        {operation === 'revise' ? <div className="grid gap-2"><label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Match every imported row to one existing card
          <select className="min-h-10 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-sm text-[var(--cf-text-strong)]" value={revisionMatchKey} onChange={(event) => { setRevisionMatchKey(event.target.value); setPendingRevision(null); }}>
            <option value="unique-id">CardForge ID column (safest)</option>
            {fieldDefinitions.filter((field) => !field.isStaticBaseText && !field.isImage).map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
          </select>
        </label>
        {revisionScopeIsStale ? <p className="text-xs text-[var(--cf-danger)]" role="alert">One or more selected Artifacts are no longer in this Set. Return to the Desk and select them again before revising.</p> : hasRequestedRevisionScope ? <p className="text-xs text-[var(--cf-text-muted)]" role="status">Revision scope: {effectiveRevisionScopeIds.length} selected Artifact{effectiveRevisionScopeIds.length === 1 ? '' : 's'}. Matches outside this stable-ID selection are ignored.</p> : <p className="text-xs text-[var(--cf-text-muted)]">Revision scope: all Artifacts in this Set.</p>}
        {!revisionScopeIsStale && effectiveRevisionScopeIds.length && revisionImageFields.length ? <div className="flex flex-wrap items-end gap-2 rounded-md border border-[var(--cf-border-subtle)] p-2"><label className="grid min-w-48 flex-1 gap-1 text-xs text-[var(--cf-text-muted)]">Picture field
          <select className="min-h-9 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-2 text-sm text-[var(--cf-text-strong)]" value={revisionResourceFieldKey} onChange={(event) => { setRevisionResourceFieldKey(event.target.value); setPendingRevision(null); }}>
            {revisionImageFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
          </select>
        </label>
        {revisionResourceFieldKey ? <BulkRevisionLibraryPicker
          currentCards={currentCards}
          fieldKey={revisionResourceFieldKey}
          fieldLabel={revisionImageFields.find((field) => field.key === revisionResourceFieldKey)?.label ?? revisionResourceFieldKey}
          targetIds={effectiveRevisionScopeIds}
          onPlan={setPendingRevision}
        /> : null}</div> : null}
        </div> : <p className="text-sm text-[var(--cf-text-muted)]">Generate appends new cards. Revise preserves existing CardForge identities and the final Set count.</p>}
      </div>

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
            <span>{reviewIssues.length > 0 ? `We found ${reviewIssues.length} thing${reviewIssues.length === 1 ? '' : 's'} to fix.` : `CardForge is ready to ${operation === 'revise' ? 'match' : 'make'} ${Math.max(0, parsedRows.length - 1)} card${parsedRows.length === 2 ? '' : 's'}.`}</span>
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

      {lastGeneratedCards.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-500/35 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3" role="status"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" /><div><p className="font-semibold text-foreground">{lastGeneratedCards.length} card{lastGeneratedCards.length === 1 ? '' : 's'} added to {activeCardSet.name}</p><p className="mt-1 text-sm text-muted-foreground">Return to the Set to arrange, tag, edit, or export the new cards.</p></div></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => { setBulkDataInput(''); setLastGeneratedCards([]); }}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Add another batch</Button>
            <Button type="button" onClick={() => onViewGeneratedCards(lastGeneratedCards)}>View cards on Desk</Button>
          </div>
        </div>
      ) : pendingRevision ? (
        <section ref={revisionPreviewRef} className="space-y-3 border border-[var(--cf-border-strong)] bg-[var(--cf-surface-inset)] p-4" aria-labelledby="revision-preview-heading" aria-live="polite" tabIndex={-1}>
          <div><h4 id="revision-preview-heading" className="font-semibold text-[var(--cf-text-strong)]">Review revision before commit</h4><p className="mt-1 text-sm text-[var(--cf-text-muted)]">{pendingRevision.matchedCount} matched · {pendingRevision.unmatchedRows.length} unmatched · {pendingRevision.ambiguousRows.length} ambiguous · final count {pendingRevision.finalArtifactCount}</p></div>
          <dl className="grid gap-2 text-xs sm:grid-cols-2"><div><dt className="font-semibold">Fields that change</dt><dd className="mt-1 text-[var(--cf-text-muted)]">{pendingRevision.changedFields.join(', ') || 'No values differ'}</dd></div><div><dt className="font-semibold">Fields preserved</dt><dd className="mt-1 text-[var(--cf-text-muted)]">{pendingRevision.preservedFields.join(', ') || 'Every existing field is supplied'}</dd></div></dl>
          {pendingRevision.unmatchedRows.length ? <p className="text-xs text-[var(--cf-warning)]">Unmatched input rows: {pendingRevision.unmatchedRows.join(', ')}. They will not be appended.</p> : null}
          {pendingRevision.ambiguousRows.length ? <p className="text-xs text-[var(--cf-danger)]">Ambiguous input rows: {pendingRevision.ambiguousRows.join(', ')}. Choose a unique match field before committing.</p> : null}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPendingRevision(null)}>Back</Button><Button type="button" disabled={!pendingRevision.matchedCount || pendingRevision.ambiguousRows.length > 0} onClick={() => { const count = onCardsRevised(pendingRevision.revisions); trackCardForgeEvent('revision_completed', { object_kind: 'card', outcome: count > 0 ? 'completed' : 'unchanged', count_bucket: count === 0 ? '0' : count <= 5 ? '1_5' : count <= 20 ? '6_20' : '21_plus' }); setLastRevisionCount(count); setPendingRevision(null); setBulkDataInput(''); toast({ title: `${count} card${count === 1 ? '' : 's'} revised`, description: 'Stable identities and unspecified fields were preserved. You can undo this revision until the next bulk revision.' }); }}>Commit revision</Button></div>
        </section>
      ) : lastRevisionCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-500/35 bg-emerald-500/10 p-4"><span role="status">{lastRevisionCount} card{lastRevisionCount === 1 ? '' : 's'} revised without changing the Set count.</span><Button type="button" variant="outline" onClick={() => { const count = onUndoRevision(); setLastRevisionCount(0); toast({ title: `${count} revision${count === 1 ? '' : 's'} undone`, description: 'The previous card values are restored.' }); }}>Undo revision</Button></div>
      ) : (
        <BulkGenerateActionBar
          isLoading={isLoading}
          disabled={isLoading || !selectedTemplateIdProp || !bulkDataInput.trim() || reviewIssues.length > 0}
          helperText={reviewIssues[0]}
          label={operation === 'revise' ? 'Preview Revision' : 'Add Cards to Set'}
          onGenerate={handleGenerate}
        />
      )}
    </section>
  );
}
