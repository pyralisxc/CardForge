"use client";

import { Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TemplateFieldDefinition } from '@/lib/templateFields';

interface BulkMappingReviewPanelProps {
  headers: string[];
  visibleHeaders: string[];
  columnMapping: Record<string, string>;
  fieldDefinitions: TemplateFieldDefinition[];
  mappedColumnCount: number;
  showAdvancedMapping: boolean;
  showUnmappedOnly: boolean;
  conflictFocusField: string | null;
  duplicateRequiredFields: string[];
  duplicateRequiredFieldCounts: Map<string, number>;
  onToggleAdvancedMapping: () => void;
  onAutoMapAgain: () => void;
  onToggleShowUnmappedOnly: () => void;
  onSetConflictFocusField: (field: string | null) => void;
  onColumnMappingChange: (mapping: Record<string, string>) => void;
}

export function BulkMappingReviewPanel({
  headers,
  visibleHeaders,
  columnMapping,
  fieldDefinitions,
  mappedColumnCount,
  showAdvancedMapping,
  showUnmappedOnly,
  conflictFocusField,
  duplicateRequiredFields,
  duplicateRequiredFieldCounts,
  onToggleAdvancedMapping,
  onAutoMapAgain,
  onToggleShowUnmappedOnly,
  onSetConflictFocusField,
  onColumnMappingChange,
}: BulkMappingReviewPanelProps) {
  const fieldOptions = fieldDefinitions.map((field) => ({ value: field.key, label: field.label, required: field.required }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">3. Mapping Review</CardTitle>
        <CardDescription>{mappedColumnCount} of {headers.length} CSV columns are mapped to template fields.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={showAdvancedMapping ? 'default' : 'outline'} onClick={onToggleAdvancedMapping}>
            Mapping Editor
          </Button>
          <Button type="button" variant="outline" onClick={onAutoMapAgain}>
            <Wand2 className="mr-2 h-4 w-4" />
            Auto-map Again
          </Button>
          <Button type="button" variant="outline" onClick={onToggleShowUnmappedOnly}>
            Show Unmapped Only
          </Button>
        </div>

        {showUnmappedOnly ? (
          <p className="text-xs text-muted-foreground">Showing {visibleHeaders.length} unmapped columns.</p>
        ) : null}

        <p className="text-sm font-medium">Mapped Template Field</p>

        {duplicateRequiredFields.length > 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium">Required field conflicts detected</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {duplicateRequiredFields.map((fieldKey) => {
                const count = duplicateRequiredFieldCounts.get(fieldKey) ?? 2;
                const fieldLabel = fieldDefinitions.find((field) => field.key === fieldKey)?.label ?? fieldKey;
                return (
                  <Button
                    key={fieldKey}
                    type="button"
                    size="sm"
                    variant={conflictFocusField === fieldKey ? 'default' : 'outline'}
                    onClick={() => onSetConflictFocusField(conflictFocusField === fieldKey ? null : fieldKey)}
                  >
                    {fieldLabel} mapped {count} times
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {visibleHeaders.map((header) => (
            <div key={header} className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
              <div>
                <Label className="text-sm font-medium">CSV Column</Label>
                <p className="font-mono text-sm">{header}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`mapping-${header}`} className="text-sm">
                  Template Field
                </Label>
                <Select
                  value={columnMapping[header] ?? '__ignore__'}
                  onValueChange={(value) => {
                    onColumnMappingChange({
                      ...columnMapping,
                      [header]: value === '__ignore__' ? '' : value,
                    });
                  }}
                >
                  <SelectTrigger id={`mapping-${header}`} aria-label={`Map CSV column ${header} to template field`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ignore__">Ignore</SelectItem>
                    {fieldOptions.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}{field.required ? ' *' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
