"use client";

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { TemplateFieldDefinition } from '@/lib/templateFields';

const FALLBACK_HIGHLIGHT_COLOR = '#ffd700';

const toColorInputValue = (value: string): string => {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  const rgbaMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(trimmed);
  if (!rgbaMatch) return FALLBACK_HIGHLIGHT_COLOR;
  const [, red, green, blue] = rgbaMatch;
  return [red, green, blue]
    .map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0'))
    .join('')
    .replace(/^/, '#');
};

interface BulkPreviewRow {
  rowNumber: number;
  mappedData: Record<string, string>;
  missingRequiredKeys: string[];
  warnings: string[];
}

interface BulkPreviewValidationPanelProps {
  rows: BulkPreviewRow[];
  filteredRows: BulkPreviewRow[];
  blockingIssues: string[];
  globalWarnings: string[];
  previewFilter: 'all' | 'warnings' | 'clean';
  previewWarningCount: number;
  strictMode: boolean;
  hasBlockingWarnings: boolean;
  fieldDefinitionMap: Map<string, TemplateFieldDefinition>;
  richTextHighlightColor: string;
  onSetPreviewFilter: (value: 'all' | 'warnings' | 'clean') => void;
  onApplyPreviewOverride: (rowNumber: number, fieldKey: string, value: string) => void;
  onSetRichTextHighlightColor: (value: string) => void;
  onSetStrictMode: (value: boolean) => void;
}

export function BulkPreviewValidationPanel({
  rows,
  filteredRows,
  blockingIssues,
  globalWarnings,
  previewFilter,
  previewWarningCount,
  strictMode,
  hasBlockingWarnings,
  fieldDefinitionMap,
  richTextHighlightColor,
  onSetPreviewFilter,
  onApplyPreviewOverride,
  onSetRichTextHighlightColor,
  onSetStrictMode,
}: BulkPreviewValidationPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">4. Preview & Validation</CardTitle>
        <CardDescription>
          Review mapped rows before generating. {rows.length} row{rows.length === 1 ? '' : 's'} parsed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <Label htmlFor="bulk-preview-filter">Preview Filter</Label>
            <Select value={previewFilter} onValueChange={(value) => onSetPreviewFilter(value as 'all' | 'warnings' | 'clean')}>
              <SelectTrigger id="bulk-preview-filter" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rows</SelectItem>
                <SelectItem value="warnings">Warnings Only</SelectItem>
                <SelectItem value="clean">Clean Rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-rich-text-highlight">Highlight Color</Label>
            <Input
              id="bulk-rich-text-highlight"
              type="color"
              value={toColorInputValue(richTextHighlightColor)}
              onChange={(event) => onSetRichTextHighlightColor(event.target.value)}
              className="h-10 w-20 p-1"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch
              id="bulk-strict-mode"
              checked={strictMode}
              onCheckedChange={onSetStrictMode}
              aria-label="Toggle strict mode for bulk generation"
            />
            <Label htmlFor="bulk-strict-mode">Strict Mode</Label>
          </div>
        </div>

        <div className="rounded-md border p-3 text-sm">
          <p>
            Strict Mode is {strictMode ? 'on' : 'off'}.
            {strictMode ? ' Generation is blocked until warnings are fixed.' : ' Warnings will not block generation.'}
          </p>
          <p className="text-muted-foreground">{previewWarningCount} warning{previewWarningCount === 1 ? '' : 's'} detected.</p>
        </div>

        {blockingIssues.length > 0 ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Blocking Issues
            </div>
            <ul className="space-y-1 text-destructive">
              {blockingIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {globalWarnings.length > 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Global Warnings
            </div>
            <ul className="space-y-1">
              {globalWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasBlockingWarnings ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Fix the blocking warnings below or turn off strict mode to continue.
          </div>
        ) : null}

        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.rowNumber} className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Row {row.rowNumber}</p>
                {row.warnings.length > 0 ? (
                  <span className="text-xs text-amber-600">{row.warnings.length} warning{row.warnings.length === 1 ? '' : 's'}</span>
                ) : (
                  <span className="text-xs text-emerald-600">Clean</span>
                )}
              </div>

              {row.warnings.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {row.warnings.map((warning) => {
                    const fieldMatch = /^Missing value for (.+)$/.exec(warning);
                    const fieldLabel = fieldMatch?.[1];
                    const fieldKey = fieldLabel
                      ? Array.from(fieldDefinitionMap.values()).find((field) => field.label === fieldLabel)?.key
                      : undefined;
                    return (
                      <div key={warning} className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                        <p className="text-sm">{warning}</p>
                        {fieldKey ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => onApplyPreviewOverride(row.rowNumber, fieldKey, 'TBD')}
                          >
                            Fill with TBD
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {Object.entries(row.mappedData).map(([fieldKey, value]) => {
                  const field = fieldDefinitionMap.get(fieldKey);
                  const label = field?.label || fieldKey;
                  return (
                    <div key={`${row.rowNumber}-${fieldKey}`} className="space-y-1">
                      <Label htmlFor={`preview-${row.rowNumber}-${fieldKey}`}>{label}</Label>
                      <Input
                        id={`preview-${row.rowNumber}-${fieldKey}`}
                        value={value}
                        onChange={(event) => onApplyPreviewOverride(row.rowNumber, fieldKey, event.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
