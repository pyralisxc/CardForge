import { nanoid } from 'nanoid';

import type { CardData, DisplayCard, TCGCardTemplate } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { completeCardDataWithTemplateDefaults } from '@/lib/cardDataDefaults';
import {
  FIELD_STYLE_PROPERTIES,
  buildFieldStyleDataKey,
  isRecognizedFieldStyleColumn,
  parseFieldStyleColumnHeader,
} from '@/lib/fieldStyleOverrides';
import { parseCSV, unparseCSV } from '@/lib/utils';

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

export const normalizeCsvHeaders = (headers: string[]): string[] =>
  headers.map((header) => header.replace(/^"|"$/g, '').trim());

const createBulkExampleDataLine = (
  template: TCGCardTemplate,
  fieldDefinitions: TemplateFieldDefinition[]
): string[] => fieldDefinitions.map((field) => {
  const keyLower = field.key.toLowerCase();
  if (field.isImage) return 'https://placehold.co/600x400.png?text=Artwork';
  const previewValue = template.templatePreviewData?.[field.key];
  if (previewValue !== undefined) return String(previewValue);
  if (field.defaultValue) return field.defaultValue;
  if (field.contentModel === 'structuredRows') return 'Row value';
  if (field.contentModel === 'rulesBlocks') return '[ability] Flying\n[effect] Deal 3 damage to any target.\n[reminder] (This can hit creatures.)';
  if (keyLower.includes('name') || keyLower.includes('title')) return 'Sample Card';
  if (keyLower.includes('cost') || keyLower.includes('value')) return '3';
  if (keyLower.includes('type')) return 'Sample Type';
  if (field.isMultiline) return 'Sample effect text.\nSecond line of text.';
  return 'value';
});

export const createBulkExampleCsv = ({
  template,
  fieldDefinitions,
}: CreateBulkExampleCsvOptions): string => {
  if (!template) return 'Select a template first.';

  const headers = fieldDefinitions.map((field) => field.key);
  const exampleDataLine = createBulkExampleDataLine(template, fieldDefinitions);

  return unparseCSV([headers, exampleDataLine]);
};

export const createBulkExampleJson = ({
  template,
  fieldDefinitions,
}: CreateBulkExampleCsvOptions): string => {
  if (!template) return '[]';
  const exampleDataLine = createBulkExampleDataLine(template, fieldDefinitions);
  const row = fieldDefinitions.reduce<Record<string, string>>((accumulator, field, index) => {
    accumulator[field.key] = exampleDataLine[index] ?? '';
    return accumulator;
  }, {});
  return JSON.stringify([row], null, 2);
};

const fieldTypeLabel = (field: TemplateFieldDefinition): string => {
  if (field.isImage) return 'image';
  if (field.contentModel === 'structuredRows') return 'structuredRows';
  if (field.contentModel === 'rulesBlocks') return 'rulesBlocks';
  if (field.supportsRichText) return 'richText';
  if (field.isMultiline) return 'multilineText';
  return 'text';
};

const createFieldStyleOverrideColumns = (field: TemplateFieldDefinition): string[] => {
  if (field.isImage) return [];
  return FIELD_STYLE_PROPERTIES.map((property) => `${field.key}.${property}`);
};

export const createBulkImportContract = ({
  template,
  fieldDefinitions,
  generatedAt = new Date().toISOString(),
}: CreateBulkImportContractOptions) => ({
  templateId: template.id,
  templateName: template.name,
  generatedAt,
  styleOverrideSyntax: {
    summary: 'Optional row-level styling columns can override template variable typography for a single generated output.',
    supportedProperties: FIELD_STYLE_PROPERTIES,
    examples: ['Name.textColor', 'Name.style.fontWeight'],
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
  })),
});

const isPlainJsonRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
};

const stringifyJsonCell = (value: unknown, rowNumber: number, key: string): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new Error(`JSON row ${rowNumber} field "${key}" must be a string, number, boolean, or empty value.`);
};

export const normalizeJsonObjectsToRows = (value: unknown): string[][] => {
  if (!Array.isArray(value)) {
    throw new Error('JSON data source must be an array of objects.');
  }
  if (value.length === 0) {
    throw new Error('JSON data source must contain at least one row object.');
  }

  const headers: string[] = [];
  value.forEach((row, index) => {
    if (!isPlainJsonRecord(row)) {
      throw new Error(`JSON row ${index + 1} must be an object.`);
    }
    Object.keys(row).forEach((key) => {
      const trimmedKey = key.trim();
      if (trimmedKey && !headers.includes(trimmedKey)) headers.push(trimmedKey);
    });
  });

  if (headers.length === 0) {
    throw new Error('JSON data source must include at least one field.');
  }

  const dataRows = value.map((row, rowIndex) => {
    const record = row as Record<string, unknown>;
    return headers.map((header) => stringifyJsonCell(record[header], rowIndex + 1, header).trim());
  });

  return [headers, ...dataRows];
};

const FIELD_LINE_REGEX = /^([^:\n]+):\s*(.*)$/;

const pushStructuredRecord = (
  records: Array<Record<string, string>>,
  currentRecord: Record<string, string>,
  activeKeyRef: { value: string | null }
) => {
  if (Object.keys(currentRecord).length > 0) {
    records.push({ ...currentRecord });
    Object.keys(currentRecord).forEach((key) => delete currentRecord[key]);
  }
  activeKeyRef.value = null;
};

export const parseStructuredTextToRows = (raw: string): string[][] => {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const records: Array<Record<string, string>> = [];
  const currentRecord: Record<string, string> = {};
  const activeKeyRef: { value: string | null } = { value: null };
  let blankLineCount = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed === '---') {
      pushStructuredRecord(records, currentRecord, activeKeyRef);
      blankLineCount = 0;
      return;
    }
    if (!trimmed) {
      blankLineCount += 1;
      if (blankLineCount >= 2) {
        pushStructuredRecord(records, currentRecord, activeKeyRef);
      } else if (activeKeyRef.value && currentRecord[activeKeyRef.value]) {
        currentRecord[activeKeyRef.value] = `${currentRecord[activeKeyRef.value]}\n`;
      }
      return;
    }

    blankLineCount = 0;
    const fieldMatch = FIELD_LINE_REGEX.exec(line);
    if (fieldMatch) {
      const key = fieldMatch[1].trim();
      if (!key) return;
      activeKeyRef.value = key;
      currentRecord[key] = fieldMatch[2] ?? '';
      return;
    }

    if (activeKeyRef.value) {
      const previous = currentRecord[activeKeyRef.value] ?? '';
      currentRecord[activeKeyRef.value] = previous ? `${previous}\n${line}` : line;
    }
  });

  pushStructuredRecord(records, currentRecord, activeKeyRef);

  if (records.length === 0) {
    throw new Error('Structured text must include at least one Field: value pair.');
  }

  return normalizeJsonObjectsToRows(records);
};

const looksLikeStructuredText = (raw: string): boolean => {
  const meaningfulLines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (meaningfulLines.length === 0) return false;
  const fieldLineCount = meaningfulLines.filter((line) => FIELD_LINE_REGEX.test(line)).length;
  return fieldLineCount > 0 && !meaningfulLines[0].includes(',');
};

export const parseBulkDataSource = (
  raw: string,
  hint: BulkDataSourceHint = 'auto'
): string[][] => {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const effectiveHint = hint === 'auto'
    ? (/^[\[{]/.test(trimmed) ? 'json' : looksLikeStructuredText(trimmed) ? 'structured' : 'csv')
    : hint;

  if (effectiveHint === 'json') {
    const parsed = JSON.parse(trimmed);
    return normalizeJsonObjectsToRows(parsed);
  }
  if (effectiveHint === 'structured') {
    return parseStructuredTextToRows(trimmed);
  }
  return parseCSV(trimmed);
};

export const buildInitialColumnMapping = (
  headers: string[],
  fieldKeys: string[]
): Record<string, string> => {
  const mapping: Record<string, string> = {};
  headers.forEach((header) => {
    const normalized = header.trim().toLowerCase();
    mapping[header] = fieldKeys.find((key) => key.toLowerCase() === normalized) ?? '';
  });
  return mapping;
};

export const updateColumnMapping = (
  current: Record<string, string>,
  header: string,
  nextValue: string
): Record<string, string> => {
  return {
    ...current,
    [header]: nextValue === '__unmapped__' ? '' : nextValue,
  };
};

export const shouldBlockBulkGeneration = (
  strictMode: boolean,
  globalWarningCount: number,
  rowWarningCount: number
): boolean => {
  return strictMode && (globalWarningCount > 0 || rowWarningCount > 0);
};

export const getBulkGenerationBlockingIssues = (
  headers: string[],
  rows: string[][],
  columnMapping: Record<string, string>
): string[] => {
  const issues: string[] = [];

  if (headers.length === 0) {
    issues.push('CSV header row is empty.');
    return issues;
  }

  const normalizedHeaders = new Map<string, string[]>();
  headers.forEach((header) => {
    const normalized = header.trim().toLowerCase();
    if (!normalized) return;
    const current = normalizedHeaders.get(normalized) ?? [];
    current.push(header);
    normalizedHeaders.set(normalized, current);
  });

  normalizedHeaders.forEach((headerVariants) => {
    if (headerVariants.length > 1) {
      issues.push(`Duplicate CSV header detected: ${headerVariants[0]}`);
    }
  });

  const mappedHeaderCount = headers.filter((header) => !!columnMapping[header]?.trim()).length;
  if (mappedHeaderCount === 0) {
    issues.push('Map at least one CSV column to a template field before generating.');
  }

  const expectedColumnCount = headers.length;
  rows.slice(1).forEach((row, index) => {
    if (row.length !== expectedColumnCount) {
      issues.push(
        `Row ${index + 2} has ${row.length} column${row.length === 1 ? '' : 's'}; expected ${expectedColumnCount}.`
      );
    }
  });

  return issues;
};

export const createBulkPreview = ({
  rows: parsedRows,
  columnMapping,
  fieldDefinitions,
  previewOverrides = {},
  maxPreviewRows = 5,
}: CreateBulkPreviewOptions): BulkPreviewResult => {
  if (parsedRows.length < 2) {
    return { rows: [], globalWarnings: [] };
  }

  const headers = normalizeCsvHeaders(parsedRows[0]);
  const fieldKeySet = new Set(fieldDefinitions.map((field) => field.key));
  const unmappedHeaders = headers.filter((header) => (
    !columnMapping[header] && !isRecognizedFieldStyleColumn(header, fieldKeySet)
  ));
  const globalWarnings: string[] = [];

  if (unmappedHeaders.length > 0) {
    globalWarnings.push(`Unmapped CSV columns will be skipped: ${unmappedHeaders.join(', ')}`);
  }

  const requiredFieldKeys = fieldDefinitions.filter((field) => field.required).map((field) => field.key);
  const mappedFieldKeys = new Set(
    Object.values(columnMapping)
      .map((value) => value?.trim())
      .filter((value): value is string => !!value)
  );
  const unmappedRequiredFields = requiredFieldKeys.filter((key) => !mappedFieldKeys.has(key));
  if (unmappedRequiredFields.length > 0) {
    globalWarnings.push(`Required template fields are not mapped: ${unmappedRequiredFields.join(', ')}`);
  }

  const duplicateRequiredFields = requiredFieldKeys.filter((key) => (
    Object.values(columnMapping).filter((mappedKey) => mappedKey === key).length > 1
  ));
  if (duplicateRequiredFields.length > 0) {
    globalWarnings.push(`Required fields mapped multiple times: ${duplicateRequiredFields.join(', ')}`);
  }

  const requiredFieldSet = new Set(requiredFieldKeys);
  const previewRows: BulkPreviewRow[] = [];
  const previewCount = Math.min(parsedRows.length - 1, maxPreviewRows);

  for (let i = 1; i <= previewCount; i += 1) {
    const values = parsedRows[i] || [];
    const mappedData: Record<string, string> = {};
    const missingRequiredKeys: string[] = [];
    const warnings: string[] = [];
    const rowNumber = i + 1;
    const rowOverrides = previewOverrides[rowNumber] || {};

    headers.forEach((header, index) => {
      const mappedKey = columnMapping[header] || '';
      if (!mappedKey) return;
      const value = String(rowOverrides[mappedKey] ?? values[index] ?? '');
      mappedData[mappedKey] = value;
      if (requiredFieldSet.has(mappedKey) && value.trim() === '') {
        missingRequiredKeys.push(mappedKey);
        warnings.push(`Missing value for ${mappedKey}`);
      }
      const field = fieldDefinitions.find((definition) => definition.key === mappedKey);
      if (field?.maxLength && value.length > field.maxLength) {
        warnings.push(`${field.label} is ${value.length} characters; maximum is ${field.maxLength}.`);
      }
    });

    previewRows.push({
      rowNumber,
      mappedData,
      missingRequiredKeys,
      warnings,
    });
  }

  return { rows: previewRows, globalWarnings };
};

export interface CreateBulkDisplayCardsOptions {
  template: TCGCardTemplate;
  fieldDefinitions: TemplateFieldDefinition[];
  rows: string[][];
  columnMapping: Record<string, string>;
  previewOverrides?: Record<number, Record<string, string>>;
  createId?: (rowNumber: number) => string;
}

export const createBulkDisplayCards = ({
  template,
  fieldDefinitions,
  rows,
  columnMapping,
  previewOverrides = {},
  createId = () => nanoid(),
}: CreateBulkDisplayCardsOptions): DisplayCard[] => {
  if (rows.length < 2) return [];

  const headers = normalizeCsvHeaders(rows[0]);
  const generatedCards: DisplayCard[] = [];
  const fieldKeySet = new Set(fieldDefinitions.map((field) => field.key));

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i];
    const cardData: CardData = {};

    headers.forEach((header: string, index: number) => {
      const mappedKey = columnMapping[header] || '';
      if (mappedKey) {
        cardData[mappedKey] = values[index] ?? '';
        return;
      }

      const styleColumn = parseFieldStyleColumnHeader(header, fieldKeySet);
      if (!styleColumn) return;

      const value = values[index] ?? '';
      if (String(value).trim()) {
        cardData[buildFieldStyleDataKey(styleColumn.fieldKey, styleColumn.property)] = value;
      }
    });

    const rowNumber = i + 1;
    const rowOverrides = previewOverrides[rowNumber];
    if (rowOverrides) {
      Object.entries(rowOverrides).forEach(([key, value]) => {
        cardData[key] = value;
      });
    }

    generatedCards.push({
      template,
      data: completeCardDataWithTemplateDefaults(fieldDefinitions, cardData),
      uniqueId: createId(rowNumber),
    });
  }

  return generatedCards;
};
