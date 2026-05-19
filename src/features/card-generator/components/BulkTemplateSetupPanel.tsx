"use client";

import { Download, FileJson } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import type { TCGCardTemplate } from '@/types';

interface BulkTemplateSetupPanelProps {
  templates: TCGCardTemplate[];
  selectedTemplateId: string | null;
  selectedTemplate?: TCGCardTemplate;
  bulkFieldDefinitions: TemplateFieldDefinition[];
  onTemplateSelectionChange: (templateId: string | null) => void;
  onDownloadExampleCsv: () => void;
  onDownloadContractJson: () => void;
}

export function BulkTemplateSetupPanel({
  templates,
  selectedTemplateId,
  selectedTemplate,
  bulkFieldDefinitions,
  onTemplateSelectionChange,
  onDownloadExampleCsv,
  onDownloadContractJson,
}: BulkTemplateSetupPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">1. Template Contract</CardTitle>
        <CardDescription>Select the template the CSV should populate.</CardDescription>
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
                  {template.name || template.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{selectedTemplate.name || selectedTemplate.id}</p>
            <p className="text-muted-foreground">
              {bulkFieldDefinitions.length} bulk field{bulkFieldDefinitions.length === 1 ? '' : 's'} available
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onDownloadExampleCsv} disabled={!selectedTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Example CSV
          </Button>
          <Button type="button" variant="outline" onClick={onDownloadContractJson} disabled={!selectedTemplate}>
            <FileJson className="mr-2 h-4 w-4" />
            Contract JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
