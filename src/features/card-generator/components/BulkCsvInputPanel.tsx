"use client";

import type { ChangeEvent, MutableRefObject } from 'react';
import { useState } from 'react';
import { FileText, FileUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TemplateFieldDefinition } from '@/domain/templates';
import type { TCGCardTemplate } from '@/domain/templates';

interface BulkCsvInputPanelProps {
  selectedTemplateId: string | null;
  selectedTemplate?: TCGCardTemplate;
  bulkDataInput: string;
  exampleCsv: string;
  exampleJson: string;
  exampleStructuredText: string;
  bulkFieldDefinitions: TemplateFieldDefinition[];
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onDataInputChange: (value: string) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

type BulkStarterChoice = 'text' | 'csv' | 'json' | 'upload' | 'blank';

const starterActions: Record<BulkStarterChoice, string> = {
  text: 'Use text starter',
  csv: 'Use example CSV',
  json: 'Use example JSON',
  upload: 'Choose file',
  blank: 'Start blank',
};

export function BulkCsvInputPanel({
  selectedTemplateId,
  selectedTemplate,
  bulkDataInput,
  exampleCsv,
  exampleJson,
  exampleStructuredText,
  bulkFieldDefinitions,
  fileInputRef,
  onDataInputChange,
  onFileUpload,
}: BulkCsvInputPanelProps) {
  const [starterChoice, setStarterChoice] = useState<BulkStarterChoice>('text');

  const useStarter = () => {
    if (starterChoice === 'upload') {
      fileInputRef.current?.click();
      return;
    }
    if (starterChoice === 'text') onDataInputChange(exampleStructuredText);
    if (starterChoice === 'csv') onDataInputChange(exampleCsv);
    if (starterChoice === 'json') onDataInputChange(exampleJson);
    if (starterChoice === 'blank') onDataInputChange('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">2. Add your card data</CardTitle>
        <CardDescription>Upload a file or paste a list. CardForge checks it as you go.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="bulk-starter-choice">Start with</Label>
            <Select value={starterChoice} onValueChange={(value) => setStarterChoice(value as BulkStarterChoice)}>
              <SelectTrigger id="bulk-starter-choice"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Plain text starter</SelectItem>
                <SelectItem value="csv">Example CSV</SelectItem>
                <SelectItem value="json">Example JSON</SelectItem>
                <SelectItem value="upload">Upload a file</SelectItem>
                <SelectItem value="blank">Start blank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={useStarter} disabled={!selectedTemplateId && starterChoice !== 'blank'}>
            {starterChoice === 'upload' ? <FileUp className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            {starterActions[starterChoice]}
          </Button>
          <input
            id="bulk-file-upload-csv"
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt,.md,text/csv,application/json,text/plain,text/markdown"
            className="sr-only"
            onChange={onFileUpload}
          />
        </div>

        {selectedTemplate ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">Card fields:</span> {bulkFieldDefinitions.map((field) => field.label).join(', ') || 'No card fields found.'}</p>
            <p><span className="font-medium text-foreground">Plain text:</span> One block becomes one card. Use Field: value lines and separate cards with ---.</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="bulkData">Add your card list</Label>
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
