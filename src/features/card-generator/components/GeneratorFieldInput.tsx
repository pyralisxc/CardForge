"use client";

import type { ChangeEvent } from 'react';
import { useId } from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CardData } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { CardForgeRichTextEditor } from '@/components/card-forge/CardForgeRichTextEditor';

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
  const editorHeight = field.editor === 'rules-textarea'
    ? compact ? 'min-h-[7rem]' : 'min-h-[10rem]'
    : compact ? 'min-h-[5.5rem]' : 'min-h-[7.5rem]';
  const currentLength = value.length;

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
        {(field.editor === 'rich-textarea' || field.editor === 'rules-textarea') ? (
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
            maxLength={field.maxLength}
            className="text-sm"
          />
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
