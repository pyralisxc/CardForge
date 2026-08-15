"use client";

import { Download, FileJson, FileText, Table2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TemplateFieldDefinition } from '@/domain/templates';
import { getTemplateSourceLabel } from '@/domain/templates';
import type { TCGCardTemplate } from '@/domain/templates';
import { createBulkContractSummary } from '@/features/card-generator/lib/bulkGeneration';

interface BulkTemplateSetupPanelProps {
  selectedTemplateId: string | null;
  selectedTemplate?: TCGCardTemplate;
  backingTemplate?: TCGCardTemplate | null;
  bulkFieldDefinitions: TemplateFieldDefinition[];
  onDownloadExampleCsv: () => void;
  onDownloadExampleJson: () => void;
  onDownloadStructuredText: () => void;
}

export function BulkTemplateSetupPanel({
  selectedTemplateId,
  selectedTemplate,
  backingTemplate,
  bulkFieldDefinitions,
  onDownloadExampleCsv,
  onDownloadExampleJson,
  onDownloadStructuredText,
}: BulkTemplateSetupPanelProps) {
  const contractSummary = createBulkContractSummary(bulkFieldDefinitions);
  const requiredHeaders = contractSummary.requiredFields.map((field) => field.key);
  const optionalHeaders = contractSummary.optionalFields.map((field) => field.key);
  const exactHeaderLine = [...requiredHeaders, ...optionalHeaders].join(', ');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">1. Template</CardTitle>
        <CardDescription>Confirm the front and back designs these cards will generate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Selected Template</p>
          <p className="font-medium">{selectedTemplate?.name || selectedTemplateId || 'No front template selected'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Back: {backingTemplate?.name || 'No back selected'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Change this in Card setup above.</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" disabled={!selectedTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download a starter file
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onDownloadStructuredText}><FileText className="mr-2 h-4 w-4" />Text / Markdown</DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadExampleCsv}><Download className="mr-2 h-4 w-4" />CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadExampleJson}><FileJson className="mr-2 h-4 w-4" />JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedTemplate ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              <p className="font-medium">{selectedTemplate.name || selectedTemplate.id}</p>
              <p className="text-muted-foreground">
                {getTemplateSourceLabel(selectedTemplate)} Template — download a starter file, edit the values, then upload or paste it below.
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
                Your card fields
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                These are the details your data can fill. Back fields begin with “back.” so front and back can share field names.
              </p>
              <div className="mt-2 rounded bg-muted/40 px-2 py-1.5 font-mono text-[11px] leading-5 text-foreground break-words">
                {exactHeaderLine || 'Select a Template to see fields.'}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-full border bg-background/50 px-2 py-0.5">CSV for spreadsheets</span>
              <span className="rounded-full border bg-background/50 px-2 py-0.5">JSON for tools</span>
              <span className="rounded-full border bg-background/50 px-2 py-0.5">TXT / MD for regular writing</span>
              <span className="rounded-full border bg-background/50 px-2 py-0.5">Rich markers allowed</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
