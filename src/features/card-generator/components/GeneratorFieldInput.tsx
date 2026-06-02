"use client";

import type { ChangeEvent } from 'react';
import { useId, useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CardData } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { CardForgeRichTextEditor } from '@/components/card-forge/CardForgeRichTextEditor';
import { cn } from '@/lib/utils';

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
}: GeneratorFieldInputProps) {
  const reactId = useId().replace(/:/g, '');
  const fieldId = `generator-field-${field.key}-${reactId}`;
  const fileInputId = `${fieldId}-file`;
  const [richTextExpanded, setRichTextExpanded] = useState(false);
  const editorHeight = field.contentModel === 'text' && field.isMultiline
    ? compact ? 'min-h-[6.5rem]' : 'min-h-[9rem]'
    : compact ? 'min-h-[4.5rem]' : 'min-h-[6rem]';
  const currentLength = value.length;
  const canUseRichText = field.editor === 'text-editor' && field.supportsRichText && !field.isImage;
  const hasRichTextMarkers = useMemo(
    () => /(\*\*[^*]+\*\*|_[^_]+_|__[^_]+__|==[^=]+==|\[color:[^\]]+\][\s\S]*?\[\/color\]|\[[a-z]+(?:\:[^\]]+)?\])/i.test(value),
    [value]
  );
  const plainControl = field.control === 'textarea' || field.isMultiline ? (
    <Textarea
      id={fieldId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`Enter ${field.label}...`}
      rows={compact ? 2 : 3}
      maxLength={field.maxLength}
      className="text-sm"
    />
  ) : (
    <Input
      id={fieldId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`Enter ${field.label}...`}
      maxLength={field.maxLength}
      className={field.isImage ? 'flex-grow' : ''}
    />
  );

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

      {field.description && field.description !== field.helperText && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      <div className={field.isImage ? 'flex items-center gap-2' : ''}>
        {canUseRichText ? (
          <div className="space-y-2">
            {plainControl}
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-muted/35"
              aria-expanded={richTextExpanded}
              aria-controls={`${fieldId}-rich-tools`}
              onClick={() => setRichTextExpanded((expanded) => !expanded)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="font-medium">Formatting tools</span>
                <span className="hidden text-muted-foreground sm:inline">
                  Bold, color, highlight, lists, and rich-text markers
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {hasRichTextMarkers ? (
                  <span className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Formatted
                  </span>
                ) : null}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', richTextExpanded && 'rotate-180')} />
              </span>
            </button>
            {richTextExpanded ? (
              <div id={`${fieldId}-rich-tools`} className="rounded-md border border-border/70 bg-background/80 p-2">
                <CardForgeRichTextEditor
                  id={`${fieldId}-rich-editor`}
                  value={value}
                  onChange={onChange}
                  highlightColor={highlightColor}
                  onHighlightColorChange={onHighlightColorChange}
                  placeholder={`Enter ${field.label}...`}
                  editorClassName={editorHeight}
                  allowedFormatting={field.allowedFormatting}
                />
              </div>
            ) : null}
          </div>
        ) : field.editor === 'text-editor' || field.control === 'textarea' ? (
          plainControl
        ) : (
          <Input
            id={fieldId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.isImage ? `URL or Data URI for ${field.label}` : `Enter ${field.label}...`}
            maxLength={field.maxLength}
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
      {field.maxLength && (
        <p className="text-[11px] text-muted-foreground">
          {currentLength}/{field.maxLength} characters
        </p>
      )}
    </div>
  );
}

export const getFieldStringValue = (data: CardData, field: TemplateFieldDefinition): string =>
  String(data[field.key] ?? '');
