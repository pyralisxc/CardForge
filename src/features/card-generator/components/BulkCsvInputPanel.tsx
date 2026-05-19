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
  bulkFieldDefinitions,
  fileInputRef,
  onDataInputChange,
  onFileUpload,
}: BulkCsvInputPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">2. CSV Source</CardTitle>
        <CardDescription>Paste CSV content or upload a file to start mapping.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!selectedTemplateId}>
            <FileUp className="mr-2 h-4 w-4" />
            Upload CSV
          </Button>
          <input
            id="bulk-file-upload-csv"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
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
        </div>

        {selectedTemplate ? (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Expected fields: {bulkFieldDefinitions.map((field) => field.label).join(', ')}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="bulkData">CSV Data</Label>
          <Textarea
            id="bulkData"
            value={bulkDataInput}
            onChange={(event) => onDataInputChange(event.target.value)}
            placeholder="Paste CSV data here"
            className="min-h-[220px] font-mono text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
