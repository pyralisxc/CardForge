import type { CardData, TCGCardTemplate } from '@/types';
import { toTitleCase } from '@/lib/utils';
import { extractTemplateFieldDefinitions, type TemplateFieldDefinition } from '@/lib/templateFields';

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
    acc[field.key] = valueForTemplateField(field, existingData);
    return acc;
  }, {});

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

  return finalData;
};
