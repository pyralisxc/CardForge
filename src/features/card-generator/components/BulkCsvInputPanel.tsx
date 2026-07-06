"use client";

import type { ChangeEvent, MutableRefObject } from 'react';
import { FileJson, FileText, FileUp, Table2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import type { TCGCardTemplate } from '@/types';

interface BulkCsvInputPanelProps {
  selectedTemplateId: string | null;
  selectedTemplate?: TCGCardTemplate;
  bulkDataInput: string;
  exampleCsv: string;
  exampleStructuredText: string;
  bulkFieldDefinitions: TemplateFieldDefinition[];
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onDataInputChange: (value: string) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function BulkCsvInputPanel({
  selectedTemplateId,
  selectedTemplate,
  bulkDataInput,
  exampleCsv,
  exampleStructuredText,
  bulkFieldDefinitions,
  fileInputRef,
  onDataInputChange,
  onFileUpload,
}: BulkCsvInputPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">2. Data Source</CardTitle>
        <CardDescription>Upload or paste spreadsheet data, app JSON, or regular Field: value writing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!selectedTemplateId}>
            <FileUp className="mr-2 h-4 w-4" />
            Upload Data
          </Button>
          <input
            id="bulk-file-upload-csv"
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt,.md,text/csv,application/json,text/plain,text/markdown"
            className="sr-only"
            onChange={onFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!selectedTemplate}
            onClick={() => onDataInputChange(exampleCsv)}
          >
            <Table2 className="mr-2 h-4 w-4" />
            Use Example CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedTemplate}
            onClick={() => onDataInputChange(exampleStructuredText)}
          >
            <FileText className="mr-2 h-4 w-4" />
            Use Text Starter
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Table2 className="h-3.5 w-3.5 text-primary" />
              CSV
            </div>
            <p className="mt-1 text-muted-foreground">Best for spreadsheets. First row is field keys, following rows are cards.</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <FileJson className="h-3.5 w-3.5 text-primary" />
              JSON
            </div>
            <p className="mt-1 text-muted-foreground">Best for generated data. Upload an array of objects using field keys.</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <FileText className="h-3.5 w-3.5 text-primary" />
              TXT / MD
            </div>
            <p className="mt-1 text-muted-foreground">Best for normal writing. Use Field: value lines and separate cards with ---.</p>
          </div>
        </div>

        {selectedTemplate ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">Expected fields:</span> {bulkFieldDefinitions.map((field) => field.label).join(', ') || 'No generator fields found.'}</p>
            <p><span className="font-medium text-foreground">Text format:</span> Field: value lines work in TXT/MD. Repeat a field block after --- to create another card.</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="bulkData">Data Source</Label>
          <Textarea
            id="bulkData"
            value={bulkDataInput}
            onChange={(event) => onDataInputChange(event.target.value)}
            placeholder={`CSV:
Name,Cost,Rules
Sample Card,3,Deal 3 damage.

Text:
Name: Sample Card
Cost: 3
Rules: Deal 3 damage.
---
Name: Second Card`}
            className="min-h-[220px] font-mono text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
