
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types';
import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { Download, PackagePlus, UploadCloud, FileText, ArrowRight } from 'lucide-react';
import { parseCSV } from '@/lib/utils';
import { extractTemplateFieldDefinitions } from '@/lib/templateFields';
import {
  buildInitialColumnMapping,
  shouldBlockBulkGeneration,
  updateColumnMapping,
} from '@/lib/bulkGeneration';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  onCardsGenerated: (cards: DisplayCard[]) => void;
  selectedTemplateIdProp: string | null; // From Zustand store via props
  onTemplateSelectionChange: (templateId: string | null) => void; // Calls Zustand action via props
}

type SupportedFileType = 'csv';

interface BulkPreviewRow {
  rowNumber: number;
  mappedData: Record<string, string>;
  missingRequiredKeys: string[];
  warnings: string[];
}

type PreviewFilter = 'all' | 'warnings' | 'clean';

export function BulkGenerator({ 
  templates, 
  onCardsGenerated,
  selectedTemplateIdProp,
  onTemplateSelectionChange 
}: BulkGeneratorProps) {
  // Local state for this component's form
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileType] = useState<SupportedFileType>('csv');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewOverrides, setPreviewOverrides] = useState<Record<number, Record<string, string>>>({});
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [strictMode, setStrictMode] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // selectedTemplate is derived from selectedTemplateIdProp (from Zustand) and templates prop.
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateIdProp);
  }, [templates, selectedTemplateIdProp]);

  // fieldDefinitions are derived from selectedTemplate.
  const fieldDefinitions = useMemo(() => {
    if (!selectedTemplate) return [];
    return extractTemplateFieldDefinitions(selectedTemplate);
  }, [selectedTemplate]);

  const fieldDefinitionMap = useMemo(() => {
    return new Map(fieldDefinitions.map((field) => [field.key, field]));
  }, [fieldDefinitions]);


  const generateExampleCSV = useCallback(() => {
    if (!selectedTemplate) return "Select a template first.";

    const headers = fieldDefinitions.map(field => field.key).join(',');
    const exampleDataLine = fieldDefinitions.map(field => {
      const keyLower = field.key.toLowerCase();
      if (field.defaultValue) return `"${field.defaultValue.replace(/"/g, '""')}"`;
      if (field.isImage) return 'https://placehold.co/600x400.png?text=Artwork';
      if (keyLower.includes('name') || keyLower.includes('title')) return 'Sample Card';
      if (keyLower.includes('cost') || keyLower.includes('value')) return '3';
      if (keyLower.includes('type')) return 'Sample Type';
      if (field.isMultiline) return '"Sample effect text.\nSecond line of text."';
      return 'value';
    }).join(',');
    return `${headers}\n${exampleDataLine}`;
  }, [fieldDefinitions, selectedTemplate]);

  const exampleCSV = useMemo(() => generateExampleCSV(), [generateExampleCSV]);

  const parsedRows = useMemo(() => {
    if (!bulkDataInput.trim() || !selectedTemplate) return [] as string[][];
    try {
      return parseCSV(bulkDataInput.trim());
    } catch {
      return [] as string[][];
    }
  }, [bulkDataInput, selectedTemplate]);

  const bulkPreview = useMemo(() => {
    if (!selectedTemplate || parsedRows.length < 2) {
      return { rows: [] as BulkPreviewRow[], globalWarnings: [] as string[] };
    }

    const headers = parsedRows[0].map((h: string) => h.replace(/^"|"$/g, '').trim());
    const unmappedHeaders = headers.filter(header => !columnMapping[header]);
    const globalWarnings: string[] = [];

    if (unmappedHeaders.length > 0) {
      globalWarnings.push(`Unmapped CSV columns will be skipped: ${unmappedHeaders.join(', ')}`);
    }

    const requiredFieldKeys = fieldDefinitions.filter(field => field.required).map(field => field.key);
    const mappedFieldKeys = new Set(
      Object.values(columnMapping)
        .map((value) => value?.trim())
        .filter((value): value is string => !!value)
    );
    const unmappedRequiredFields = requiredFieldKeys.filter((key) => !mappedFieldKeys.has(key));
    if (unmappedRequiredFields.length > 0) {
      globalWarnings.push(`Required template fields are not mapped: ${unmappedRequiredFields.join(', ')}`);
    }

    const requiredFieldSet = new Set(requiredFieldKeys);

    const rows: BulkPreviewRow[] = [];
    const previewCount = Math.min(parsedRows.length - 1, 5);
    for (let i = 1; i <= previewCount; i++) {
      const values = parsedRows[i] || [];
      const mappedData: Record<string, string> = {};
      const missingRequiredKeys: string[] = [];
      const warnings: string[] = [];
      const rowOverrides = previewOverrides[i + 1] || {};

      headers.forEach((header, index) => {
        const mappedKey = columnMapping[header] || '';
        if (!mappedKey) return;
        const value = String(rowOverrides[mappedKey] ?? values[index] ?? '');
        mappedData[mappedKey] = value;
        if (requiredFieldSet.has(mappedKey) && value.trim() === '') {
          missingRequiredKeys.push(mappedKey);
          warnings.push(`Missing value for ${mappedKey}`);
        }
      });

      rows.push({
        rowNumber: i + 1,
        mappedData,
        missingRequiredKeys,
        warnings,
      });
    }

    return { rows, globalWarnings };
  }, [columnMapping, fieldDefinitions, parsedRows, previewOverrides, selectedTemplate]);

  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === 'warnings') {
      return bulkPreview.rows.filter(row => row.warnings.length > 0);
    }
    if (previewFilter === 'clean') {
      return bulkPreview.rows.filter(row => row.warnings.length === 0);
    }
    return bulkPreview.rows;
  }, [bulkPreview.rows, previewFilter]);

  const previewWarningCount = useMemo(() => {
    return bulkPreview.rows.reduce((acc, row) => acc + row.warnings.length, 0);
  }, [bulkPreview.rows]);

  const hasBlockingWarnings = shouldBlockBulkGeneration(
    strictMode,
    bulkPreview.globalWarnings.length,
    previewWarningCount
  );

  // Auto-build column mapping when CSV or template changes
  useEffect(() => {
    if (!bulkDataInput.trim() || !selectedTemplate) {
      setCsvHeaders([]);
      setColumnMapping({});
      return;
    }
    try {
      const rows = parseCSV(bulkDataInput.trim());
      if (rows.length < 1) return;
      const headers = rows[0].map((h: string) => h.replace(/^"|"$/g, '').trim());
      setCsvHeaders(headers);
      const keys = fieldDefinitions.map(field => field.key);
      setColumnMapping(buildInitialColumnMapping(headers, keys));
    } catch {
      setCsvHeaders([]);
      setColumnMapping({});
    }
  }, [bulkDataInput, selectedTemplate, fieldDefinitions]);

  useEffect(() => {
    setPreviewOverrides({});
    setPreviewFilter('all');
    setShowAdvancedMapping(false);
  }, [bulkDataInput, selectedTemplateIdProp]);

  const applyPreviewOverride = useCallback((rowNumber: number, fieldKey: string, value: string) => {
    setPreviewOverrides((prev) => ({
      ...prev,
      [rowNumber]: {
        ...(prev[rowNumber] || {}),
        [fieldKey]: value,
      },
    }));
  }, []);

  // Comment: The selectedTemplateIdProp is managed by Zustand.
  // Defaulting logic (e.g., selecting the first template if the current one is invalid)
  // is handled by the Zustand store's _rehydrateCallback or actions like deleteTemplate.
  // No local useEffect is needed here to manage selectedTemplateId.

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: "Template Required", description: "Please select a TCG template for the cards.", variant: "destructive" });
      return;
    }
    if (!bulkDataInput.trim()) {
      toast({ title: "Error", description: "Please provide data for card generation.", variant: "destructive" });
      return;
    }
    if (hasBlockingWarnings) {
      toast({
        title: "Strict Mode Prevented Generation",
        description: "Resolve mapping and required-field warnings, or disable Strict Mode to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const parsedRows = parseCSV(bulkDataInput.trim());
      if (parsedRows.length < 2) {
        toast({ title: "Error", description: "CSV data must include a header row and at least one data row.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const headers = parsedRows[0].map((h: string) => h.replace(/^"|"$/g, '').trim());
      const generatedCards: DisplayCard[] = [];

      for (let i = 1; i < parsedRows.length; i++) {
        const values = parsedRows[i];
        const cardData: CardData = {};
        headers.forEach((header: string, index: number) => {
          const mappedKey = columnMapping[header] || '';
          if (!mappedKey) return;
          cardData[mappedKey] = values[index] ?? '';
        });

        const rowOverrides = previewOverrides[i + 1];
        if (rowOverrides) {
          Object.entries(rowOverrides).forEach(([key, value]) => {
            cardData[key] = value;
          });
        }

        const displayCard: DisplayCard = {
            template: selectedTemplate,
            data: cardData,
            uniqueId: nanoid()
        };
        generatedCards.push(displayCard);
      }

      onCardsGenerated(generatedCards);
      if (generatedCards.length > 0) {
        toast({ title: "Success", description: `${generatedCards.length} TCG cards generated.` });
      } else {
        toast({ title: "No Cards Generated", description: "No data was processed to generate cards.", variant: "default" });
      }

    } catch (error) {
      console.error("Error generating TCG cards:", error);
      toast({ title: "Generation Error", description: `Failed to generate TCG cards: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBulkDataInput(e.target.value);
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (selectedFileType === 'csv' && !file.name.toLowerCase().endsWith('.csv')) {
        toast({ title: "Invalid File", description: "Please upload a .csv file.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setBulkDataInput(text);
        toast({ title: "File Loaded", description: `Content of "${file.name}" loaded.` });
      };
      reader.onerror = () => {
         toast({ title: "File Read Error", description: `Could not read file "${file.name}".`, variant: "destructive" });
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplateCSV = () => {
    if (!selectedTemplate) {
      toast({ title: "Template Required", description: "Please select a TCG template first.", variant: "default" });
      return;
    }
    const csvContent = exampleCSV;
    if (!csvContent.trim() || !csvContent.includes('\n') || csvContent.startsWith("Select a template first.")) {
       toast({ title: "Template Error", description: "Could not generate CSV template. Ensure template has placeholders.", variant: "destructive" });
       return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const safeTemplateName = selectedTemplate.name.replace(/[^a-z0-9_]/gi, '_').substring(0,20);
    const fileName = `template_${safeTemplateName}.csv`;
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: `${fileName} downloaded.` });
  };

  const handleTemplateSelectChange = useCallback((id: string | null) => {
    onTemplateSelectionChange(id);
    setBulkDataInput(''); // Clear data input when template changes
  }, [onTemplateSelectionChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Bulk Card Generation</CardTitle>
        <CardDescription>Generate multiple cards using CSV data, based on a selected template.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
            <Label htmlFor="bulkTemplateSelect">1. Select Template*</Label>
            <Select
              value={selectedTemplateIdProp ?? undefined} // Use prop from Zustand
              onValueChange={handleTemplateSelectChange} // Calls Zustand action via prop
              disabled={templates.length === 0}
            >
              <SelectTrigger id="bulkTemplateSelect">
                <SelectValue placeholder="Choose template (Required)" />
              </SelectTrigger>
              <SelectContent>
                {templates.length > 0 ? (
                  templates.map(t => <SelectItem key={`bulk-template-${t.id || 'bulk-no-id'}`} value={t.id!}>{t.name || `Template ${t.id?.substring(0,5)}`}</SelectItem>)
                ) : (
                  <SelectItem value="no-bulk-templates" disabled>No templates available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

        <div className="flex flex-col sm:flex-row gap-2">
            <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={!selectedTemplateIdProp}
                className="w-full sm:w-auto flex-grow sm:flex-grow-0"
            >
                <UploadCloud className="mr-2 h-4 w-4" /> Upload CSV File
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                aria-hidden="true"
                style={{ display: 'none' }}
                id="bulk-file-upload-csv"
            />
            <Button
                onClick={handleDownloadTemplateCSV}
                variant="outline"
                disabled={!selectedTemplateIdProp}
                className="w-full sm:w-auto flex-grow sm:flex-grow-0"
            >
                <FileText className="mr-2 h-4 w-4" /> Download Example CSV
            </Button>
        </div>

        <div>
          <Label htmlFor="bulkData">
            2. Paste CSV Data or Verify Uploaded Content
          </Label>
          <Textarea
            id="bulkData"
            value={bulkDataInput}
            onChange={handleDataInputChange}
            placeholder={selectedTemplate ? `Example CSV for "${selectedTemplate.name}":\n${exampleCSV}` : `Select a template to see example CSV structure.`}
            rows={8}
            className="font-mono text-sm"
            disabled={!selectedTemplateIdProp}
          />
          {selectedTemplate && <p className="text-xs text-muted-foreground mt-1">
            Your CSV headers should be: <strong>{fieldDefinitions.map(field => field.key).join(',') || "No placeholders found in selected template"}</strong>.
            {fieldDefinitions.some(field => field.isMultiline || field.supportsRichText) ? ' Quote multiline cells, and rich-text markers will be preserved.' : ''}
          </p>}
           {!selectedTemplateIdProp && <p className="text-xs text-muted-foreground mt-1">Select a template first.</p>}
        </div>

        {/* Column Mapping Table */}
        {csvHeaders.length > 0 && selectedTemplate && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <ArrowRight className="h-4 w-4" /> Column Mapping
            </Label>
            <p className="text-xs text-muted-foreground">
              Columns are auto-matched to template fields. Use Advanced mapping only when headers do not match.
            </p>
            <div className="rounded-md border overflow-hidden text-xs">
              <div className="grid grid-cols-[1fr_16px_1fr] gap-0 bg-muted/50 px-3 py-1.5 font-semibold text-muted-foreground">
                <span>CSV Column</span>
                <span />
                <span>Auto Match Result</span>
              </div>
              {csvHeaders.map(header => (
                <div key={header} className="grid grid-cols-[1fr_16px_1fr] items-center gap-0 border-t px-3 py-1">
                  <span className="font-mono truncate pr-1">{header}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className={columnMapping[header] ? 'font-mono' : 'text-muted-foreground'}>
                    {columnMapping[header] || 'Unmapped (ignored)'}
                  </span>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdvancedMapping((prev) => !prev)}>
              {showAdvancedMapping ? 'Hide Advanced Mapping' : 'Advanced Mapping'}
            </Button>
            {showAdvancedMapping && (
              <div className="rounded-md border overflow-hidden text-xs">
                <div className="grid grid-cols-[1fr_16px_1fr] gap-0 bg-muted/50 px-3 py-1.5 font-semibold text-muted-foreground">
                  <span>CSV Column</span>
                  <span />
                  <span>Template Field</span>
                </div>
                {csvHeaders.map(header => (
                  <div key={`${header}-advanced`} className="grid grid-cols-[1fr_16px_1fr] items-center gap-0 border-t px-3 py-1">
                    <span className="font-mono truncate pr-1">{header}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Select
                      value={columnMapping[header] || '__unmapped__'}
                      onValueChange={val => setColumnMapping(prev => updateColumnMapping(prev, header, val))}
                    >
                      <SelectTrigger className="h-7 text-xs border-muted bg-transparent shadow-none focus:ring-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unmapped__">— ignore —</SelectItem>
                        {fieldDefinitions.map(field => (
                          <SelectItem key={`${header}-${field.key}`} value={field.key}>{field.key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
            {csvHeaders.some(h => !columnMapping[h]) && (
              <p className="text-xs text-amber-500 flex items-center gap-1">⚠ Some columns are unmapped and will be skipped.</p>
            )}
          </div>
        )}

        {bulkPreview.rows.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-sm font-medium">3. Preview & Validation</Label>
            <p className="text-xs text-muted-foreground">Previewing the first {bulkPreview.rows.length} data rows after column mapping.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={previewFilter === 'all' ? 'default' : 'outline'} onClick={() => setPreviewFilter('all')}>
                All ({bulkPreview.rows.length})
              </Button>
              <Button type="button" size="sm" variant={previewFilter === 'warnings' ? 'default' : 'outline'} onClick={() => setPreviewFilter('warnings')}>
                Needs Fix ({bulkPreview.rows.filter(row => row.warnings.length > 0).length})
              </Button>
              <Button type="button" size="sm" variant={previewFilter === 'clean' ? 'default' : 'outline'} onClick={() => setPreviewFilter('clean')}>
                Clean ({bulkPreview.rows.filter(row => row.warnings.length === 0).length})
              </Button>
            </div>
            {bulkPreview.globalWarnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-600">⚠ {warning}</p>
            ))}
            <div className="space-y-2">
              {filteredPreviewRows.map((row) => (
                <div key={row.rowNumber} className="rounded border bg-muted/30 p-2">
                  <p className="text-xs font-semibold">Row {row.rowNumber}</p>
                  <div className="mt-1 grid grid-cols-1 gap-1 text-xs md:grid-cols-2">
                    {Object.entries(row.mappedData).map(([key, value]) => (
                      <p key={`${row.rowNumber}-${key}`} className="truncate">
                        <span className="font-mono">{key}</span>: {value || <span className="text-muted-foreground">(empty)</span>}
                      </p>
                    ))}
                  </div>
                  {row.warnings.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {row.warnings.map((warning) => (
                        <p key={`${row.rowNumber}-${warning}`} className="text-xs text-amber-600">⚠ {warning}</p>
                      ))}
                      {row.missingRequiredKeys.map((fieldKey) => (
                        <div key={`${row.rowNumber}-${fieldKey}-quickfix`} className="mt-1 rounded border bg-background p-2">
                          <p className="text-xs font-medium">Quick fix: {fieldKey}</p>
                          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Input
                              className="h-8 rounded border px-2 text-xs"
                              value={row.mappedData[fieldKey] ?? ''}
                              onChange={(e) => applyPreviewOverride(row.rowNumber, fieldKey, e.target.value)}
                              placeholder={`Enter value for ${fieldKey}`}
                            />
                            {fieldDefinitionMap.get(fieldKey)?.defaultValue && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => applyPreviewOverride(row.rowNumber, fieldKey, fieldDefinitionMap.get(fieldKey)?.defaultValue ?? '')}
                              >
                                Use template default
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => applyPreviewOverride(row.rowNumber, fieldKey, 'TBD')}
                            >
                              Fill with TBD
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredPreviewRows.length === 0 && (
                <p className="text-xs text-muted-foreground">No rows in this filter.</p>
              )}
            </div>
          </div>
        )}

        {bulkPreview.rows.length > 0 && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="bulk-strict-mode" className="text-sm font-medium">Strict Mode</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, generation is blocked until all mapping and required-field warnings are resolved.
                </p>
              </div>
              <Switch
                id="bulk-strict-mode"
                checked={strictMode}
                onCheckedChange={setStrictMode}
                aria-label="Toggle strict mode for bulk generation"
              />
            </div>
            {strictMode && hasBlockingWarnings && (
              <p className="text-xs text-amber-600">
                Strict Mode is on. Resolve warnings in Preview & Validation or disable Strict Mode to generate.
              </p>
            )}
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isLoading || !selectedTemplateIdProp || !bulkDataInput.trim() || hasBlockingWarnings}
          className="w-full"
        >
          {isLoading ? 'Generating...' : <> <Download className="mr-2 h-4 w-4" /> Generate Cards from Data</>}
        </Button>
      </CardContent>
    </Card>
  );
}

    
