import type { CardData, TCGCardTemplate } from '@/types';
import { toTitleCase } from '@/lib/utils';
import { extractTemplateFieldDefinitions, type TemplateFieldDefinition } from '@/lib/templateFields';
import { buildStructuredRowsDataKey, stringifyStructuredRowsValue } from '@/lib/structuredRows';

const imagePlaceholderForField = (fieldKey: string): string =>
  `https://placehold.co/600x400.png?text=${encodeURIComponent(toTitleCase(fieldKey))}`;

export const valueForTemplateField = (
  field: TemplateFieldDefinition,
  existingData?: CardData | null
): string | number => {
  const currentValue = existingData?.[field.key];
  if (currentValue !== undefined) return currentValue;
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.isImage) return imagePlaceholderForField(field.key);
  return '';
};

export const initializeCardDataFromTemplate = (
  template?: TCGCardTemplate | null,
  existingData?: CardData | null
): [TemplateFieldDefinition[], CardData] => {
  if (!template) return [[], {}];

  const fields = extractTemplateFieldDefinitions(template);
  const data = fields.reduce<CardData>((acc, field) => {
    const previewValue = template.templatePreviewData?.[field.key];
    acc[field.key] = valueForTemplateField(field, existingData ?? (previewValue !== undefined ? { [field.key]: previewValue } : null));
    return acc;
  }, {});

  const structuredGroups = new Map<string, TemplateFieldDefinition[]>();
  fields.forEach((field) => {
    if (field.contentModel !== 'structuredRows' || !field.sourceElementId) return;
    const group = structuredGroups.get(field.sourceElementId) ?? [];
    group.push(field);
    structuredGroups.set(field.sourceElementId, group);
  });

  structuredGroups.forEach((groupFields, elementId) => {
    const dataKey = buildStructuredRowsDataKey(elementId);
    if (existingData?.[dataKey] !== undefined) {
      data[dataKey] = existingData[dataKey];
      return;
    }
    data[dataKey] = stringifyStructuredRowsValue([
      Object.fromEntries(groupFields.map((field) => [field.key, String(data[field.key] ?? '')])),
    ]);
  });

  return [fields, data];
};

export const completeCardDataWithTemplateDefaults = (
  fields: TemplateFieldDefinition[],
  data: CardData
): CardData => {
  const finalData = { ...data };

  fields.forEach((field) => {
    if (finalData[field.key] === undefined || String(finalData[field.key]).trim() === `{{${field.key}}}`) {
      finalData[field.key] = valueForTemplateField(field);
    }
  });

  const structuredGroups = new Map<string, TemplateFieldDefinition[]>();
  fields.forEach((field) => {
    if (field.contentModel !== 'structuredRows' || !field.sourceElementId) return;
    const group = structuredGroups.get(field.sourceElementId) ?? [];
    group.push(field);
    structuredGroups.set(field.sourceElementId, group);
  });

  structuredGroups.forEach((groupFields, elementId) => {
    const dataKey = buildStructuredRowsDataKey(elementId);
    if (finalData[dataKey] !== undefined) return;
    finalData[dataKey] = stringifyStructuredRowsValue([
      Object.fromEntries(groupFields.map((field) => [field.key, String(finalData[field.key] ?? '')])),
    ]);
  });

  return finalData;
};
