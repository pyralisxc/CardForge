"use client";

import { CheckCircle2, Wand2 } from 'lucide-react';

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
  unmappedRequiredFields: string[];
  onToggleAdvancedMapping: () => void;
  onAutoMapAgain: () => void;
  onAutoMapRequiredFields: () => void;
  onToggleShowUnmappedOnly: () => void;
  onSetConflictFocusField: (field: string | null) => void;
  onResolveDuplicateRequiredField: (fieldKey: string) => void;
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
  unmappedRequiredFields,
  onToggleAdvancedMapping,
  onAutoMapAgain,
  onAutoMapRequiredFields,
  onToggleShowUnmappedOnly,
  onSetConflictFocusField,
  onResolveDuplicateRequiredField,
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

        {unmappedRequiredFields.length > 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Required fields need mapping</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {unmappedRequiredFields
                    .map((fieldKey) => fieldDefinitions.find((field) => field.key === fieldKey)?.label ?? fieldKey)
                    .join(', ')}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={onAutoMapRequiredFields}>
                <Wand2 className="mr-2 h-3.5 w-3.5" />
                Auto-map Required
              </Button>
            </div>
          </div>
        ) : headers.length > 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Required fields are mapped.
          </div>
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
                  <div key={fieldKey} className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={conflictFocusField === fieldKey ? 'default' : 'outline'}
                      onClick={() => onSetConflictFocusField(conflictFocusField === fieldKey ? null : fieldKey)}
                    >
                      {fieldLabel} mapped {count} times
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onResolveDuplicateRequiredField(fieldKey)}
                    >
                      Keep first {fieldLabel}
                    </Button>
                  </div>
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
