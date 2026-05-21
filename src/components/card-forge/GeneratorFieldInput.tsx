"use client";

import type { ChangeEvent } from 'react';
import { useId } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AVAILABLE_FONTS, FONT_WEIGHTS } from '@/lib/constants';
import type { CardData, CardFieldStyleOverride } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import {
  createStructuredListRow,
  normalizeStructuredListColumns,
  parseStructuredListValue,
  serializeStructuredListRows,
} from '@/lib/structuredList';
import { summarizeStructuredListPressure, summarizeTextValuePressure } from '@/lib/textCapacity';
import { CardForgeRichTextEditor } from '@/components/card-forge/CardForgeRichTextEditor';

const INHERIT_VALUE = '__inherit__';

const capacityTone = (status?: 'comfortable' | 'tight' | 'overflow') => {
  if (status === 'overflow') return 'border-destructive/40 bg-destructive/10 text-destructive';
  if (status === 'tight') return 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300';
  return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300';
};

function StructuredListFieldEditor({
  field,
  value,
  onChange,
}: {
  field: TemplateFieldDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  const columns = normalizeStructuredListColumns(field.structuredListColumns);
  const rows = parseStructuredListValue(value, columns);
  const safeRows = rows.length > 0 ? rows : [createStructuredListRow(columns)];
  const pressure = summarizeStructuredListPressure(safeRows.length, field.sourceTextCapacity);

  const commitRows = (nextRows: typeof safeRows) => onChange(serializeStructuredListRows(nextRows));
  const updateCell = (rowIndex: number, columnKey: string, nextValue: string) => {
    commitRows(safeRows.map((row, index) => (
      index === rowIndex
        ? { ...row, values: { ...row.values, [columnKey]: nextValue } }
        : row
    )));
  };
  const moveRow = (rowIndex: number, direction: -1 | 1) => {
    const nextIndex = rowIndex + direction;
    if (nextIndex < 0 || nextIndex >= safeRows.length) return;
    const nextRows = [...safeRows];
    const [row] = nextRows.splice(rowIndex, 1);
    nextRows.splice(nextIndex, 0, row);
    commitRows(nextRows);
  };

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/10 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Repeatable rows</p>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => commitRows([...safeRows, createStructuredListRow(columns)])}>
          <Plus className="h-3.5 w-3.5" /> Add row
        </Button>
      </div>
      {pressure && (
        <p className={`rounded-md border px-2 py-1 text-[11px] ${capacityTone(pressure.status)}`}>
          {pressure.message}
        </p>
      )}
      <div className="space-y-2">
        {safeRows.map((row, rowIndex) => (
          <div key={row.id} className="rounded-md border border-border/60 bg-background/70 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Row {rowIndex + 1}</span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={rowIndex === 0} onClick={() => moveRow(rowIndex, -1)} aria-label={`Move ${field.label} row ${rowIndex + 1} up`}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={rowIndex === safeRows.length - 1} onClick={() => moveRow(rowIndex, 1)} aria-label={`Move ${field.label} row ${rowIndex + 1} down`}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={safeRows.length <= 1} onClick={() => commitRows(safeRows.filter((_, index) => index !== rowIndex))} aria-label={`Remove ${field.label} row ${rowIndex + 1}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <div key={column.key} className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{column.label}</Label>
                  <Input
                    value={row.values[column.key] || ''}
                    placeholder={column.placeholder || column.label}
                    onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GeneratorFieldInputProps {
  field: TemplateFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  fileInputRef?: (node: HTMLInputElement | null) => void;
  onImageUpload?: (event: ChangeEvent<HTMLInputElement>, fieldKey: string) => void;
  compact?: boolean;
  showLabel?: boolean;
  showDefaultText?: boolean;
  styleOverride?: CardFieldStyleOverride;
  onStyleOverrideChange?: (value: CardFieldStyleOverride | undefined) => void;
}

export function GeneratorFieldInput({
  field,
  value,
  onChange,
  highlightColor,
  onHighlightColorChange,
  fileInputRef,
  onImageUpload,
  compact = false,
  showLabel = true,
  showDefaultText = true,
  styleOverride,
  onStyleOverrideChange,
}: GeneratorFieldInputProps) {
  const reactId = useId().replace(/:/g, '');
  const fieldId = `generator-field-${field.key}-${reactId}`;
  const fileInputId = `${fieldId}-file`;
  const textPressure = !field.isImage && field.editor !== 'structured-list'
    ? summarizeTextValuePressure(value || field.defaultValue || '', field.sourceTextCapacity)
    : undefined;
  const editorHeight = field.editor === 'rules-textarea'
    ? compact ? 'min-h-[7rem]' : 'min-h-[10rem]'
    : compact ? 'min-h-[5.5rem]' : 'min-h-[7.5rem]';
  const canOverrideStyle = !field.isImage && !!onStyleOverrideChange;
  const updateStyleOverride = (updates: CardFieldStyleOverride) => {
    const next = { ...(styleOverride || {}), ...updates };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined && value !== '')) as CardFieldStyleOverride;
    onStyleOverrideChange?.(Object.keys(cleaned).length > 0 ? cleaned : undefined);
  };

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={fieldId} className="text-sm font-medium">
            {field.label} {field.isImage ? '(Image URL or Upload)' : ''}
          </Label>
          {field.required && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Required
            </span>
          )}
        </div>
      )}

      {showDefaultText && field.defaultValue && !field.isImage && (
        <p className="text-[11px] text-muted-foreground">Default text: {field.defaultValue}</p>
      )}

      <div className={field.isImage ? 'flex items-center gap-2' : ''}>
        {field.editor === 'structured-list' ? (
          <StructuredListFieldEditor field={field} value={value} onChange={onChange} />
        ) : (field.editor === 'rich-textarea' || field.editor === 'rules-textarea') ? (
          <CardForgeRichTextEditor
            id={fieldId}
            value={value}
            onChange={onChange}
            highlightColor={highlightColor}
            onHighlightColorChange={onHighlightColorChange}
            placeholder={field.contentModel === 'rulesBlocks' ? `Enter ${field.label} blocks...` : `Enter ${field.label}...`}
            editorClassName={editorHeight}
          />
        ) : field.control === 'textarea' ? (
          <Textarea
            id={fieldId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={`Enter ${field.label}...`}
            rows={compact ? 2 : 3}
            className="text-sm"
          />
        ) : (
          <Input
            id={fieldId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.isImage ? `URL or Data URI for ${field.label}` : `Enter ${field.label}...`}
            className={field.isImage ? 'flex-grow' : ''}
          />
        )}

        {field.isImage && onImageUpload && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById(fileInputId)?.click()}
              className="shrink-0"
              aria-label={`Upload image for ${field.label}`}
            >
              <Upload className="mr-2 h-4 w-4" /> Upload
            </Button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(event) => onImageUpload(event, field.key)}
              style={{ display: 'none' }}
              id={fileInputId}
              aria-label={`Upload image for ${field.label}`}
            />
          </>
        )}
      </div>

      {field.helperText && (
        <p className="text-xs text-muted-foreground">{field.helperText}</p>
      )}

      {textPressure && (
        <p className={`rounded-md border px-2 py-1 text-[11px] ${capacityTone(textPressure.status)}`}>
          {textPressure.message}
        </p>
      )}

      {canOverrideStyle && (
        <details className="rounded-md border border-border/70 bg-muted/10 p-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Advanced style overrides for this card
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Font</Label>
              <Select
                value={styleOverride?.fontFamily || INHERIT_VALUE}
                onValueChange={(value) => updateStyleOverride({ fontFamily: value === INHERIT_VALUE ? undefined : value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INHERIT_VALUE}>Template default</SelectItem>
                  {AVAILABLE_FONTS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>{font.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Size</Label>
              <Input
                type="number"
                min="6"
                max="144"
                value={styleOverride?.fontSizePx ?? ''}
                placeholder="Template"
                onChange={(event) => updateStyleOverride({
                  fontSizePx: event.target.value === '' ? undefined : Math.max(6, Math.min(144, Number(event.target.value) || 14)),
                })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Weight</Label>
              <Select
                value={styleOverride?.fontWeight || INHERIT_VALUE}
                onValueChange={(value) => updateStyleOverride({ fontWeight: value === INHERIT_VALUE ? undefined : value as CardFieldStyleOverride['fontWeight'] })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INHERIT_VALUE}>Template default</SelectItem>
                  {FONT_WEIGHTS.map((weight) => (
                    <SelectItem key={weight} value={weight}>{weight.replace('font-', '')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Color</Label>
              <Input
                type="color"
                value={styleOverride?.textColor && /^#[0-9a-fA-F]{6}$/.test(styleOverride.textColor) ? styleOverride.textColor : '#f8fafc'}
                onChange={(event) => updateStyleOverride({ textColor: event.target.value })}
                className="h-8 p-1"
              />
            </div>
          </div>
          {styleOverride && Object.keys(styleOverride).length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs"
              onClick={() => onStyleOverrideChange(undefined)}
            >
              Clear this card's style overrides
            </Button>
          )}
        </details>
      )}
    </div>
  );
}

export const getFieldStringValue = (data: CardData, field: TemplateFieldDefinition): string =>
  String(data[field.key] ?? '');
