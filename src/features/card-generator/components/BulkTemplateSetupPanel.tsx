"use client";

import { Download, FileJson, Table2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { getTemplateDisplayName, getTemplateSourceLabel } from '@/lib/templateDisplay';
import type { TCGCardTemplate } from '@/types';
import { createBulkContractSummary } from '@/lib/bulkGeneration';

interface BulkTemplateSetupPanelProps {
  templates: TCGCardTemplate[];
  selectedTemplateId: string | null;
  selectedTemplate?: TCGCardTemplate;
  bulkFieldDefinitions: TemplateFieldDefinition[];
  onTemplateSelectionChange: (templateId: string | null) => void;
  onDownloadExampleCsv: () => void;
  onDownloadExampleJson: () => void;
  onDownloadContractJson: () => void;
}

export function BulkTemplateSetupPanel({
  templates,
  selectedTemplateId,
  selectedTemplate,
  bulkFieldDefinitions,
  onTemplateSelectionChange,
  onDownloadExampleCsv,
  onDownloadExampleJson,
  onDownloadContractJson,
}: BulkTemplateSetupPanelProps) {
  const contractSummary = createBulkContractSummary(bulkFieldDefinitions);
  const requiredHeaders = contractSummary.requiredFields.map((field) => field.key);
  const optionalHeaders = contractSummary.optionalFields.map((field) => field.key);
  const exactHeaderLine = [...requiredHeaders, ...optionalHeaders].join(', ');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">1. Template Contract</CardTitle>
        <CardDescription>Select the layout template your data source should populate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bulk-template-select">Template</Label>
          <Select
            value={selectedTemplateId ?? '__none__'}
            onValueChange={(value) => onTemplateSelectionChange(value === '__none__' ? null : value)}
          >
            <SelectTrigger id="bulk-template-select" aria-label="Choose template for bulk generation">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Choose a template</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id ?? template.name ?? 'template'} value={template.id ?? ''}>
                  {getTemplateDisplayName(template)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onDownloadExampleCsv} disabled={!selectedTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV Starter
          </Button>
          <Button type="button" variant="outline" onClick={onDownloadExampleJson} disabled={!selectedTemplate}>
            <FileJson className="mr-2 h-4 w-4" />
            Download JSON Starter
          </Button>
          <Button type="button" variant="ghost" onClick={onDownloadContractJson} disabled={!selectedTemplate}>
            <FileJson className="mr-2 h-4 w-4" />
            Advanced Contract
          </Button>
        </div>

        {selectedTemplate ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              <p className="font-medium">{selectedTemplate.name || selectedTemplate.id}</p>
              <p className="text-muted-foreground">
                {getTemplateSourceLabel(selectedTemplate)} template - download a starter file, edit the values, then upload or paste it below.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded border bg-background/50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Required</p>
                <p className="font-semibold">{contractSummary.requiredFieldCount}</p>
              </div>
              <div className="rounded border bg-background/50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Optional</p>
                <p className="font-semibold">{contractSummary.optionalFieldCount}</p>
              </div>
              <div className="rounded border bg-background/50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Rich Text</p>
                <p className="font-semibold">{contractSummary.richTextFieldCount}</p>
              </div>
            </div>

            <div className="rounded border bg-background/50 p-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Table2 className="h-3.5 w-3.5 text-primary" />
                Starter file fields
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                CSV and JSON starters use these exact field keys. Text or Markdown imports can use readable Field: value lines.
              </p>
              <div className="mt-2 rounded bg-muted/40 px-2 py-1.5 font-mono text-[11px] leading-5 text-foreground break-words">
                {exactHeaderLine || 'Select a template to see fields.'}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-full border bg-background/50 px-2 py-0.5">CSV</span>
              <span className="rounded-full border bg-background/50 px-2 py-0.5">JSON</span>
              <span className="rounded-full border bg-background/50 px-2 py-0.5">TXT / MD Field: value</span>
              <span className="rounded-full border bg-background/50 px-2 py-0.5">Numbered or bulleted text</span>
              <span className="rounded-full border bg-background/50 px-2 py-0.5">Rich markers</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
