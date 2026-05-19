import { nanoid } from 'nanoid';

import type { CardData, DisplayCard, TCGCardTemplate } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { completeCardDataWithTemplateDefaults } from '@/lib/cardDataDefaults';
import { unparseCSV } from '@/lib/utils';

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

export interface CreateBulkPreviewOptions {
  rows: string[][];
  columnMapping: Record<string, string>;
  fieldDefinitions: TemplateFieldDefinition[];
  previewOverrides?: Record<number, Record<string, string>>;
  maxPreviewRows?: number;
}

export const normalizeCsvHeaders = (headers: string[]): string[] =>
  headers.map((header) => header.replace(/^"|"$/g, '').trim());

export const createBulkExampleCsv = ({
  template,
  fieldDefinitions,
}: CreateBulkExampleCsvOptions): string => {
  if (!template) return 'Select a template first.';

  const headers = fieldDefinitions.map((field) => field.key);
  const exampleDataLine = fieldDefinitions.map((field) => {
    const keyLower = field.key.toLowerCase();
    if (field.isImage) return 'https://placehold.co/600x400.png?text=Artwork';
    const previewValue = template.templatePreviewData?.[field.key];
    if (previewValue !== undefined) return String(previewValue);
    if (field.defaultValue) return field.defaultValue;
    if (field.contentModel === 'rulesBlocks') return '[ability] Flying\n[effect] Deal 3 damage to any target.\n[reminder] (This can hit creatures.)';
    if (keyLower.includes('name') || keyLower.includes('title')) return 'Sample Card';
    if (keyLower.includes('cost') || keyLower.includes('value')) return '3';
    if (keyLower.includes('type')) return 'Sample Type';
    if (field.isMultiline) return 'Sample effect text.\nSecond line of text.';
    return 'value';
  });

  return unparseCSV([headers, exampleDataLine]);
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
  const unmappedHeaders = headers.filter((header) => !columnMapping[header]);
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

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i];
    const cardData: CardData = {};

    headers.forEach((header: string, index: number) => {
      const mappedKey = columnMapping[header] || '';
      if (!mappedKey) return;
      cardData[mappedKey] = values[index] ?? '';
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
