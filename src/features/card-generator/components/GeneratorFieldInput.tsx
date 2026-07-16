"use client";

import type { ChangeEvent } from 'react';
import { useId, useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CardData } from '@/domain/cards';
import type { TemplateFieldDefinition } from '@/features/template-editor/lib/templateFields';
import { CardForgeRichTextEditor } from '@/components/card-forge/CardForgeRichTextEditor';
import { cn } from '@/lib/utils';
import type { FieldStyleProperty } from '@/features/card-generator/lib/fieldStyleOverrides';
import type { ImageFieldOverrideProperty } from '@/features/card-generator/lib/imageFieldOverrides';

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
  styleValues?: Partial<Record<FieldStyleProperty, string>>;
  onStyleChange?: (property: FieldStyleProperty, value: string) => void;
  imageStyleValues?: Partial<Record<ImageFieldOverrideProperty, string>>;
  onImageStyleChange?: (property: ImageFieldOverrideProperty, value: string) => void;
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
  styleValues,
  onStyleChange,
  imageStyleValues,
  onImageStyleChange,
}: GeneratorFieldInputProps) {
  const reactId = useId().replace(/:/g, '');
  const fieldId = `generator-field-${field.key}-${reactId}`;
  const fileInputId = `${fieldId}-file`;
  const [richTextExpanded, setRichTextExpanded] = useState(false);
  const [imageToolsExpanded, setImageToolsExpanded] = useState(false);
  const editorHeight = field.contentModel === 'text' && field.isMultiline
    ? compact ? 'min-h-[6.5rem]' : 'min-h-[9rem]'
    : compact ? 'min-h-[4.5rem]' : 'min-h-[6rem]';
  const currentLength = value.length;
  const canUseRichText = field.editor === 'text-editor' && field.supportsRichText && !field.isImage;
  const currentFontWeight = styleValues?.fontWeight || '';
  const currentFontStyle = styleValues?.fontStyle || '';
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
          <div className="space-y-1.5">
            {richTextExpanded ? (
              <CardForgeRichTextEditor
                id={`${fieldId}-rich-editor`}
                value={value}
                onChange={onChange}
                highlightColor={highlightColor}
                onHighlightColorChange={onHighlightColorChange}
                placeholder={`Enter ${field.label}...`}
                editorClassName={compact ? 'min-h-[5.5rem]' : editorHeight}
                allowedFormatting={field.allowedFormatting}
              />
            ) : plainControl}
            <button
              type="button"
              className="flex min-h-8 w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-muted/35"
              aria-expanded={richTextExpanded}
              aria-controls={`${fieldId}-rich-tools`}
              onClick={() => setRichTextExpanded((expanded) => !expanded)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="font-medium">{richTextExpanded ? 'Hide formatting tools' : 'Formatting tools'}</span>
                <span className="hidden text-muted-foreground sm:inline">Bold, color, lists, size, and style</span>
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
              <div id={`${fieldId}-rich-tools`} className="grid gap-2 rounded-md border border-border/70 bg-background/80 p-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor={`${fieldId}-font-size`} className="text-[10px] text-muted-foreground">Font Size</Label>
                  <Input
                    id={`${fieldId}-font-size`}
                    type="number"
                    min="6"
                    max="96"
                    value={styleValues?.fontSizePx || ''}
                    placeholder="Template"
                    onChange={(event) => onStyleChange?.('fontSizePx', event.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${fieldId}-font-weight`} className="text-[10px] text-muted-foreground">Weight</Label>
                  <select
                    id={`${fieldId}-font-weight`}
                    value={currentFontWeight}
                    onChange={(event) => onStyleChange?.('fontWeight', event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">Template</option>
                    <option value="font-normal">Normal</option>
                    <option value="font-medium">Medium</option>
                    <option value="font-semibold">Semibold</option>
                    <option value="font-bold">Bold</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${fieldId}-font-style`} className="text-[10px] text-muted-foreground">Style</Label>
                  <select
                    id={`${fieldId}-font-style`}
                    value={currentFontStyle}
                    onChange={(event) => onStyleChange?.('fontStyle', event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">Template</option>
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>
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

      {field.isImage ? (
        <div className="space-y-1.5">
          <button
            type="button"
            className="flex min-h-8 w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-muted/35"
            aria-expanded={imageToolsExpanded}
            aria-controls={`${fieldId}-image-tools`}
            onClick={() => setImageToolsExpanded((expanded) => !expanded)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="font-medium">{imageToolsExpanded ? 'Hide image tools' : 'Image tools'}</span>
              <span className="hidden text-muted-foreground sm:inline">Fit, crop, position, flip, and frame</span>
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', imageToolsExpanded && 'rotate-180')} />
          </button>
          {imageToolsExpanded ? (
            <div id={`${fieldId}-image-tools`} className="grid gap-2 rounded-md border border-border/70 bg-background/80 p-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={`${fieldId}-image-fit`} className="text-[10px] text-muted-foreground">Fit</Label>
                <select
                  id={`${fieldId}-image-fit`}
                  value={imageStyleValues?.fit || ''}
                  onChange={(event) => onImageStyleChange?.('fit', event.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Template</option>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Fill</option>
                  <option value="none">None</option>
                </select>
              </div>
              <ImageToolInput fieldId={fieldId} label="Position X" property="positionX" placeholder="center" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Position Y" property="positionY" placeholder="center" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Scale" property="scale" placeholder="1" type="number" step="0.05" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Offset X" property="offsetX" placeholder="0" type="number" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Offset Y" property="offsetY" placeholder="0" type="number" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Rotation" property="rotation" placeholder="0" type="number" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolCheckbox fieldId={fieldId} label="Flip X" property="flipX" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolCheckbox fieldId={fieldId} label="Flip Y" property="flipY" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Frame X" property="frameX" placeholder="Template" type="number" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Frame Y" property="frameY" placeholder="Template" type="number" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Frame W" property="frameWidth" placeholder="Template" type="number" values={imageStyleValues} onChange={onImageStyleChange} />
              <ImageToolInput fieldId={fieldId} label="Frame H" property="frameHeight" placeholder="Template" type="number" values={imageStyleValues} onChange={onImageStyleChange} />
            </div>
          ) : null}
        </div>
      ) : null}

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

function ImageToolInput({
  fieldId,
  label,
  property,
  placeholder,
  type = 'text',
  step,
  values,
  onChange,
}: {
  fieldId: string;
  label: string;
  property: ImageFieldOverrideProperty;
  placeholder: string;
  type?: 'text' | 'number';
  step?: string;
  values?: Partial<Record<ImageFieldOverrideProperty, string>>;
  onChange?: (property: ImageFieldOverrideProperty, value: string) => void;
}) {
  const id = `${fieldId}-image-${property}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        id={id}
        type={type}
        step={step}
        value={values?.[property] || ''}
        placeholder={placeholder}
        onChange={(event) => onChange?.(property, event.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );
}

function ImageToolCheckbox({
  fieldId,
  label,
  property,
  values,
  onChange,
}: {
  fieldId: string;
  label: string;
  property: ImageFieldOverrideProperty;
  values?: Partial<Record<ImageFieldOverrideProperty, string>>;
  onChange?: (property: ImageFieldOverrideProperty, value: string) => void;
}) {
  const id = `${fieldId}-image-${property}`;
  const checked = values?.[property] === 'true' || values?.[property] === '1';
  return (
    <label htmlFor={id} className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange?.(property, event.target.checked ? 'true' : '')}
      />
      {label}
    </label>
  );
}
