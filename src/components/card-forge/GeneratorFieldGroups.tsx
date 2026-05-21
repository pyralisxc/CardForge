"use client";

import type { ChangeEvent, MutableRefObject } from 'react';
import { Layers } from 'lucide-react';

import type { CardData, CardFieldStyleOverride, CardFieldStyleOverrides } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { isStaticSegmentFieldKey, resolveTemplateTextSegments } from '@/lib/textBindings';
import { RichTextContent } from '@/lib/textTools';
import { GeneratorFieldInput, getFieldStringValue } from '@/components/card-forge/GeneratorFieldInput';

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
  styleOverrides?: CardFieldStyleOverrides;
  onFieldStyleOverrideChange?: (fieldKey: string, value: CardFieldStyleOverride | undefined) => void;
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
      if (existing.contentModel !== 'rulesBlocks' && field.contentModel === 'rulesBlocks') {
        existing.contentModel = 'rulesBlocks';
      } else if (existing.contentModel === 'plainText' && field.contentModel === 'richText') {
        existing.contentModel = 'richText';
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
  model === 'rulesBlocks' ? 'rulesBlocks' : model === 'richText' ? 'richText' : 'plainText';

export function GeneratorFieldGroups({
  fields,
  data,
  onFieldChange,
  highlightColor,
  onHighlightColorChange,
  fileInputRefs,
  onImageUpload,
  styleOverrides,
  onFieldStyleOverrideChange,
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
        const resolvedGroupText = groupSourceContent
          ? resolveTemplateTextSegments(
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
              {orderedFields.map((field) => (
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
                    styleOverride={styleOverrides?.[field.key]}
                    onStyleOverrideChange={onFieldStyleOverrideChange
                      ? (value) => onFieldStyleOverrideChange(field.key, value)
                      : undefined}
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
