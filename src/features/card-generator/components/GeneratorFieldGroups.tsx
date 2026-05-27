"use client";

import type { ChangeEvent, MutableRefObject } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CardData } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { isStaticSegmentFieldKey, resolveTemplateTextSegments } from '@/lib/textBindings';
import { RichTextContent } from '@/lib/textTools';
import { GeneratorFieldInput, getFieldStringValue } from '@/features/card-generator/components/GeneratorFieldInput';
import {
  buildStructuredRowsDataKey,
  parseStructuredRowsValue,
  stringifyStructuredRowsValue,
  structuredRowToCardData,
} from '@/lib/structuredRows';

interface FieldGroup {
  id: string;
  label: string;
  preview?: string;
  contentModel: TemplateFieldDefinition['contentModel'];
  fields: TemplateFieldDefinition[];
}

interface GeneratorFieldGroupsProps {
  fields: TemplateFieldDefinition[];
  data: CardData;
  onFieldChange: (fieldKey: string, value: string) => void;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  fileInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>, fieldKey: string) => void;
  emptyMessage?: string;
}

const getFieldPreviewValue = (field: TemplateFieldDefinition, data: CardData) => {
  const current = data[field.key];
  if (current !== undefined && current !== null && String(current).trim() !== '') {
    return String(current);
  }
  if (field.defaultValue !== undefined && String(field.defaultValue).trim() !== '') {
    return String(field.defaultValue);
  }
  return `[${field.label}]`;
};

const groupGeneratorFields = (fields: TemplateFieldDefinition[]): FieldGroup[] =>
  fields.reduce<FieldGroup[]>((groups, field) => {
    const groupId = field.sourceElementId || (field.isImage ? `image:${field.key}` : 'ungrouped');
    const existing = groups.find((group) => group.id === groupId);
    if (existing) {
      existing.fields.push(field);
      if (field.contentModel === 'structuredRows') {
        existing.contentModel = 'structuredRows';
      } else if (existing.contentModel !== 'structuredRows') {
        existing.contentModel = 'text';
      }
      return groups;
    }

    groups.push({
      id: groupId,
      label: field.sourceElementName || (field.isImage ? 'Artwork / Image' : 'Template Fields'),
      preview: field.sourceElementPreview,
      contentModel: field.contentModel,
      fields: [field],
    });
    return groups;
  }, []);

const orderFieldsForEditing = (fields: TemplateFieldDefinition[]) =>
  [...fields].sort((left, right) => {
    const leftRank = isStaticSegmentFieldKey(left.key) ? 0 : 1;
    const rightRank = isStaticSegmentFieldKey(right.key) ? 0 : 1;
    return leftRank - rightRank;
  });

const contentModelForPreview = (model: FieldGroup['contentModel']) =>
  model === 'structuredRows' ? 'richText' : 'rulesBlocks';

const buildDefaultStructuredRows = (fields: TemplateFieldDefinition[], data: CardData) => [
  Object.fromEntries(fields.map((field) => [field.key, getFieldPreviewValue(field, data)])),
];

function StructuredRowsEditor({
  group,
  fields,
  data,
  onFieldChange,
}: {
  group: FieldGroup;
  fields: TemplateFieldDefinition[];
  data: CardData;
  onFieldChange: (fieldKey: string, value: string) => void;
}) {
  const dataKey = buildStructuredRowsDataKey(group.id);
  const rows = parseStructuredRowsValue(data[dataKey]);
  const effectiveRows = rows.length > 0 ? rows : buildDefaultStructuredRows(fields, data);

  const writeRows = (nextRows: Array<Record<string, string>>) => {
    onFieldChange(dataKey, stringifyStructuredRowsValue(nextRows));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Repeat this element's authored row pattern. Each row keeps separate values for the variables inside this text element.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={() => writeRows([...effectiveRows, Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? '']))])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Row
        </Button>
      </div>

      {effectiveRows.map((row, rowIndex) => {
        const rowSourceContent = fields[0]?.sourceElementContent;
        const rowPreview = rowSourceContent
          ? resolveTemplateTextSegments(group.id, rowSourceContent, structuredRowToCardData(group.id, row), false)
          : group.preview;

        return (
          <div key={`structured-row-${group.id}-${rowIndex}`} className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Row {rowIndex + 1}</p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={effectiveRows.length <= 1}
                aria-label={`Remove row ${rowIndex + 1}`}
                onClick={() => writeRows(effectiveRows.filter((_, index) => index !== rowIndex))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {rowPreview ? (
              <p className="rounded border border-border/50 bg-muted/20 px-2 py-1 text-xs text-muted-foreground">{rowPreview}</p>
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              {fields.map((field) => (
                <div key={`${group.id}-${rowIndex}-${field.key}`} className="space-y-1">
                  <Label className="text-xs">{field.label}</Label>
                  <Input
                    value={row[field.key] ?? ''}
                    onChange={(event) => {
                      const nextRows = effectiveRows.map((currentRow, index) => (
                        index === rowIndex ? { ...currentRow, [field.key]: event.target.value } : currentRow
                      ));
                      writeRows(nextRows);
                    }}
                    placeholder={field.defaultValue || field.label}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GeneratorFieldGroups({
  fields,
  data,
  onFieldChange,
  highlightColor,
  onHighlightColorChange,
  fileInputRefs,
  onImageUpload,
  emptyMessage = 'No editable fields were detected for this template.',
}: GeneratorFieldGroupsProps) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {groupGeneratorFields(fields).map((group) => {
        const orderedFields = orderFieldsForEditing(group.fields);
        const groupSourceContent = orderedFields[0]?.sourceElementContent;
        const isStructuredRows = group.contentModel === 'structuredRows';
        const structuredRows = isStructuredRows ? parseStructuredRowsValue(data[buildStructuredRowsDataKey(group.id)]) : [];
        const resolvedGroupText = groupSourceContent
          ? isStructuredRows && structuredRows.length > 0
            ? structuredRows
              .map((row) => resolveTemplateTextSegments(group.id, groupSourceContent, structuredRowToCardData(group.id, row), false))
              .join('\n')
            : resolveTemplateTextSegments(
              group.id,
              groupSourceContent,
              orderedFields.reduce<CardData>((acc, field) => {
                acc[field.key] = getFieldPreviewValue(field, data);
                return acc;
              }, {}),
              false
            )
          : undefined;

        return (
          <section key={group.id} className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  {group.label}
                </p>
                {resolvedGroupText ? (
                  <RichTextContent
                    text={resolvedGroupText}
                    contentModel={contentModelForPreview(group.contentModel)}
                    className="text-sm text-foreground"
                  />
                ) : group.preview ? (
                  <p className="text-sm text-foreground">{group.preview}</p>
                ) : null}
              </div>
              <div className="shrink-0 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                {orderedFields.length} {orderedFields.length === 1 ? 'field' : 'fields'}
              </div>
            </div>

            <div className="space-y-2">
              {isStructuredRows ? (
                <StructuredRowsEditor
                  group={group}
                  fields={orderedFields}
                  data={data}
                  onFieldChange={onFieldChange}
                />
              ) : orderedFields.map((field) => (
                <div key={field.key} className="rounded-md border border-border/60 bg-background/60 p-3">
                  <GeneratorFieldInput
                    field={field}
                    value={getFieldStringValue(data, field)}
                    onChange={(value) => onFieldChange(field.key, value)}
                    highlightColor={highlightColor}
                    onHighlightColorChange={onHighlightColorChange}
                    fileInputRef={(el) => {
                      fileInputRefs.current[field.key] = el;
                    }}
                    onImageUpload={onImageUpload}
                    showDefaultText={false}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
