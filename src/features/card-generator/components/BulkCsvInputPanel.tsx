"use client";

import type { ChangeEvent, MutableRefObject } from 'react';
import { FileUp } from 'lucide-react';

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
        <CardDescription>Upload or paste CSV, JSON, Markdown, or plain Field: value text.</CardDescription>
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
            variant="ghost"
            disabled={!selectedTemplate}
            onClick={() => onDataInputChange(exampleCsv)}
          >
            Use Example CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!selectedTemplate}
            onClick={() => onDataInputChange(exampleStructuredText)}
          >
            Use Text Starter
          </Button>
        </div>

        {selectedTemplate ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>Expected fields: {bulkFieldDefinitions.map((field) => field.label).join(', ')}</p>
            <p>Readable text works too: use Field: value lines, with optional numbering or bullets between cards.</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="bulkData">Data Source</Label>
          <Textarea
            id="bulkData"
            value={bulkDataInput}
            onChange={(event) => onDataInputChange(event.target.value)}
            placeholder="Paste CSV, JSON, Markdown, or Field: value text here"
            className="min-h-[220px] font-mono text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
