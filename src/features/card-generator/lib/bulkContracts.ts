import type { TCGCardTemplate, TemplateFieldDefinition } from '@/domain/templates';
import { FIELD_CONTRACT_VERSION } from '@/domain/templates';
import { FIELD_STYLE_PROPERTIES, IMAGE_FIELD_OVERRIDE_PROPERTIES } from '@/domain/rendering';
import { unparseCSV } from '@/features/card-generator/lib/csv';

export interface BulkPreviewRow {
  rowNumber: number;
  mappedData: Record<string, string>;
  missingRequiredKeys: string[];
  warnings: string[];
}

export interface BulkPreviewResult {
  rows: BulkPreviewRow[];
  globalWarnings: string[];
}

export interface CreateBulkExampleCsvOptions {
  template: TCGCardTemplate | null | undefined;
  backingTemplate?: TCGCardTemplate | null;
  fieldDefinitions: TemplateFieldDefinition[];
}

export type BulkDataSourceHint = 'auto' | 'csv' | 'json' | 'structured';

export interface CreateBulkPreviewOptions {
  rows: string[][];
  columnMapping: Record<string, string>;
  fieldDefinitions: TemplateFieldDefinition[];
  previewOverrides?: Record<number, Record<string, string>>;
  maxPreviewRows?: number;
}

export interface CreateBulkImportContractOptions {
  template: TCGCardTemplate;
  fieldDefinitions: TemplateFieldDefinition[];
  generatedAt?: string;
}

export interface BulkContractSummary {
  fieldCount: number;
  requiredFieldCount: number;
  optionalFieldCount: number;
  richTextFieldCount: number;
  imageFieldCount: number;
  structuredRowFieldCount: number;
  structuredRowGroupCount: number;
  requiredFields: Array<{ key: string; label: string; type: string }>;
  optionalFields: Array<{ key: string; label: string; type: string }>;
  structuredRowGroups: Array<{ id: string; label: string; columns: Array<{ key: string; label: string }> }>;
}

export const BACKING_BULK_FIELD_PREFIX = 'back.';

export const isBackingBulkFieldKey = (key: string): boolean => key.startsWith(BACKING_BULK_FIELD_PREFIX);

export const getBackingTemplateFieldKey = (key: string): string => (
  isBackingBulkFieldKey(key) ? key.slice(BACKING_BULK_FIELD_PREFIX.length) : key
);

export const createBulkFaceFieldDefinitions = (
  frontFields: TemplateFieldDefinition[],
  backingFields: TemplateFieldDefinition[] = [],
): TemplateFieldDefinition[] => [
  ...frontFields,
  ...backingFields.map((field) => ({
    ...field,
    key: `${BACKING_BULK_FIELD_PREFIX}${field.key}`,
    label: `Back · ${field.label}`,
    sourceElementId: field.sourceElementId
      ? `${BACKING_BULK_FIELD_PREFIX}${field.sourceElementId}`
      : undefined,
    sourceElementName: field.sourceElementName
      ? `Back · ${field.sourceElementName}`
      : undefined,
  })),
];

export const normalizeCsvHeaders = (headers: string[]): string[] =>
  headers.map((header) => header.replace(/^"|"$/g, '').trim());

const createBulkExampleDataLine = (
  template: TCGCardTemplate,
  fieldDefinitions: TemplateFieldDefinition[],
  backingTemplate?: TCGCardTemplate | null,
): string[] => fieldDefinitions.map((field) => {
  const templateFieldKey = getBackingTemplateFieldKey(field.key);
  const fieldTemplate = isBackingBulkFieldKey(field.key) ? backingTemplate : template;
  const keyLower = templateFieldKey.toLowerCase();
  if (field.isImage) return 'https://placehold.co/600x400.png?text=Artwork';
  const previewValue = fieldTemplate?.templatePreviewData?.[templateFieldKey];
  if (previewValue !== undefined) return String(previewValue);
  if (field.defaultValue) return field.defaultValue;
  if (field.contentModel === 'structuredRows') return 'Row value';
  if (field.contentModel === 'text' && field.isMultiline) return '[ability] Flying\n[effect] Deal 3 damage to any target.\n[reminder] (This can hit creatures.)';
  if (keyLower.includes('name') || keyLower.includes('title')) return 'Sample Card';
  if (keyLower.includes('cost') || keyLower.includes('value')) return '3';
  if (keyLower.includes('type')) return 'Sample Type';
  if (field.isMultiline) return 'Sample effect text.\nSecond line of text.';
  return 'value';
});

export const createBulkExampleCsv = ({
  template,
  backingTemplate,
  fieldDefinitions,
}: CreateBulkExampleCsvOptions): string => {
  if (!template) return 'Select a template first.';

  const headers = fieldDefinitions.map((field) => field.key);
  const exampleDataLine = createBulkExampleDataLine(template, fieldDefinitions, backingTemplate);

  return unparseCSV([headers, exampleDataLine]);
};

export const createBulkExampleJson = ({
  template,
  backingTemplate,
  fieldDefinitions,
}: CreateBulkExampleCsvOptions): string => {
  if (!template) return '[]';
  const exampleDataLine = createBulkExampleDataLine(template, fieldDefinitions, backingTemplate);
  const row = fieldDefinitions.reduce<Record<string, string>>((accumulator, field, index) => {
    accumulator[field.key] = exampleDataLine[index] ?? '';
    return accumulator;
  }, {});
  return JSON.stringify([row], null, 2);
};

export const createBulkExampleStructuredText = ({
  template,
  backingTemplate,
  fieldDefinitions,
}: CreateBulkExampleCsvOptions): string => {
  if (!template) return 'Select a template first.';
  const exampleDataLine = createBulkExampleDataLine(template, fieldDefinitions, backingTemplate);
  return fieldDefinitions
    .map((field, index) => `${field.key}: ${exampleDataLine[index] ?? ''}`)
    .join('\n');
};

const fieldTypeLabel = (field: TemplateFieldDefinition): string => {
  if (field.isImage) return 'image';
  if (field.contentModel === 'structuredRows') return 'structuredRows';
  return 'text';
};

const createFieldStyleOverrideColumns = (field: TemplateFieldDefinition): string[] => {
  if (field.isImage) return [];
  return FIELD_STYLE_PROPERTIES.map((property) => `${field.key}.${property}`);
};

const createImageFieldOverrideColumns = (field: TemplateFieldDefinition): string[] => {
  if (!field.isImage) return [];
  return IMAGE_FIELD_OVERRIDE_PROPERTIES.map((property) => `${field.key}.image.${property}`);
};

export const createBulkContractSummary = (fieldDefinitions: TemplateFieldDefinition[]): BulkContractSummary => {
  const structuredRowGroups = new Map<string, { id: string; label: string; columns: Array<{ key: string; label: string }> }>();

  fieldDefinitions
    .filter((field) => field.contentModel === 'structuredRows')
    .forEach((field) => {
      const groupId = field.sourceElementId || 'structuredRows';
      const group = structuredRowGroups.get(groupId) ?? {
        id: groupId,
        label: field.sourceElementName || 'Structured Rows',
        columns: [],
      };
      group.columns.push({ key: field.key, label: field.label || field.key });
      structuredRowGroups.set(groupId, group);
    });

  const requiredFields = fieldDefinitions
    .filter((field) => field.required)
    .map((field) => ({
      key: field.key,
      label: field.label,
      type: fieldTypeLabel(field),
    }));
  const optionalFields = fieldDefinitions
    .filter((field) => !field.required)
    .map((field) => ({
      key: field.key,
      label: field.label,
      type: fieldTypeLabel(field),
    }));

  return {
    fieldCount: fieldDefinitions.length,
    requiredFieldCount: requiredFields.length,
    optionalFieldCount: Math.max(0, fieldDefinitions.length - requiredFields.length),
    richTextFieldCount: fieldDefinitions.filter((field) => field.supportsRichText).length,
    imageFieldCount: fieldDefinitions.filter((field) => field.isImage).length,
    structuredRowFieldCount: fieldDefinitions.filter((field) => field.contentModel === 'structuredRows').length,
    structuredRowGroupCount: structuredRowGroups.size,
    requiredFields,
    optionalFields,
    structuredRowGroups: Array.from(structuredRowGroups.values()),
  };
};

export const createBulkImportContract = ({
  template,
  fieldDefinitions,
  generatedAt = new Date().toISOString(),
}: CreateBulkImportContractOptions) => ({
  contractVersion: FIELD_CONTRACT_VERSION,
  templateId: template.id,
  templateName: template.name,
  generatedAt,
  styleOverrideSyntax: {
    summary: 'Optional row-level styling columns can override template variable typography for a single generated output.',
    supportedProperties: FIELD_STYLE_PROPERTIES,
    examples: ['Name.textColor', 'Name.style.fontWeight'],
  },
  imageOverrideSyntax: {
    summary: 'Optional row-level image columns can override image fit, crop, frame, and transform for a single generated output.',
    supportedProperties: IMAGE_FIELD_OVERRIDE_PROPERTIES,
    examples: ['Portrait.image.fit', 'Portrait.image.scale'],
  },
  fields: fieldDefinitions.map((field) => ({
    key: field.key,
    label: field.label,
    type: fieldTypeLabel(field),
    required: field.required,
    multiline: field.isMultiline,
    supportsRichText: field.supportsRichText,
    defaultValue: field.defaultValue ?? '',
    description: field.description ?? '',
    example: field.example ?? '',
    maxLength: field.maxLength,
    allowedFormatting: field.allowedFormatting ?? [],
    helperText: field.helperText ?? '',
    styleOverrideColumns: createFieldStyleOverrideColumns(field),
    imageOverrideColumns: createImageFieldOverrideColumns(field),
  })),
});
