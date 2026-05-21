import { nanoid } from 'nanoid';

import type { CardData, DisplayCard, TCGCardTemplate } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { completeCardDataWithTemplateDefaults } from '@/lib/cardDataDefaults';
import { unparseCSV } from '@/lib/utils';
import {
  createStructuredListRow,
  normalizeStructuredListColumns,
  serializeStructuredListRows,
  type StructuredListRow,
} from '@/lib/structuredList';

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

interface IndexedStructuredHeader {
  fieldKey: string;
  rowIndex: number;
  columnKey: string;
}

export const normalizeCsvHeaders = (headers: string[]): string[] =>
  headers.map((header) => header.replace(/^"|"$/g, '').trim());

export const parseIndexedStructuredHeader = (
  header: string,
  fieldDefinitions: TemplateFieldDefinition[]
): IndexedStructuredHeader | null => {
  const match = header.trim().match(/^(.+?)\[(\d+)\]\.([^.\[\]]+)$/);
  if (!match) return null;

  const [, rawFieldKey, rawIndex, rawColumn] = match;
  const field = fieldDefinitions.find((definition) =>
    definition.contentModel === 'structuredList' && definition.key.toLowerCase() === rawFieldKey.trim().toLowerCase()
  );
  if (!field) return null;

  const columns = normalizeStructuredListColumns(field.structuredListColumns);
  const normalizedColumn = rawColumn.trim().toLowerCase();
  const column = columns.find((candidate) =>
    candidate.key.toLowerCase() === normalizedColumn || candidate.label.toLowerCase() === normalizedColumn
  );
  if (!column) return null;

  return {
    fieldKey: field.key,
    rowIndex: Math.max(0, Number(rawIndex) - 1),
    columnKey: column.key,
  };
};

const createStructuredRowsFromIndexedColumns = (
  field: TemplateFieldDefinition,
  entries: Array<{ rowIndex: number; columnKey: string; value: string }>
): string => {
  const columns = normalizeStructuredListColumns(field.structuredListColumns);
  const rowsByIndex = new Map<number, StructuredListRow>();

  entries.forEach((entry) => {
    const row = rowsByIndex.get(entry.rowIndex) ?? createStructuredListRow(columns);
    row.id = `row-${entry.rowIndex + 1}`;
    row.values = { ...row.values, [entry.columnKey]: entry.value };
    rowsByIndex.set(entry.rowIndex, row);
  });

  const rows = Array.from(rowsByIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row)
    .filter((row) => columns.some((column) => row.values[column.key]?.trim()));

  return serializeStructuredListRows(rows);
};

export const buildBulkMappedData = (
  headers: string[],
  values: string[],
  columnMapping: Record<string, string>,
  fieldDefinitions: TemplateFieldDefinition[],
  rowOverrides?: Record<string, string>
): Record<string, string> => {
  const fieldDefinitionMap = new Map(fieldDefinitions.map((field) => [field.key, field]));
  const mappedData: Record<string, string> = {};
  const structuredEntries = new Map<string, Array<{ rowIndex: number; columnKey: string; value: string }>>();

  headers.forEach((header, index) => {
    const mappedKey = columnMapping[header] || '';
    if (!mappedKey) return;

    const field = fieldDefinitionMap.get(mappedKey);
    const indexedStructuredHeader = field?.contentModel === 'structuredList'
      ? parseIndexedStructuredHeader(header, fieldDefinitions)
      : null;
    const value = String(values[index] ?? '');

    if (indexedStructuredHeader && indexedStructuredHeader.fieldKey === mappedKey) {
      const entries = structuredEntries.get(mappedKey) ?? [];
      entries.push({
        rowIndex: indexedStructuredHeader.rowIndex,
        columnKey: indexedStructuredHeader.columnKey,
        value,
      });
      structuredEntries.set(mappedKey, entries);
      return;
    }

    mappedData[mappedKey] = value;
  });

  structuredEntries.forEach((entries, fieldKey) => {
    const field = fieldDefinitionMap.get(fieldKey);
    if (!field) return;
    mappedData[fieldKey] = createStructuredRowsFromIndexedColumns(field, entries);
  });

  if (rowOverrides) {
    Object.entries(rowOverrides).forEach(([key, value]) => {
      mappedData[key] = value;
    });
  }

  return mappedData;
};

export const createBulkExampleCsv = ({
  template,
  fieldDefinitions,
}: CreateBulkExampleCsvOptions): string => {
  if (!template) return 'Select a template first.';

  const headers = fieldDefinitions.flatMap((field) => {
    if (field.contentModel !== 'structuredList') return [field.key];
    const columns = normalizeStructuredListColumns(field.structuredListColumns);
    return [1, 2].flatMap((rowNumber) =>
      columns.map((column) => `${field.key}[${rowNumber}].${column.label}`)
    );
  });
  const exampleDataLine = fieldDefinitions.flatMap((field) => {
    const keyLower = field.key.toLowerCase();
    if (field.contentModel === 'structuredList') {
      const columns = normalizeStructuredListColumns(field.structuredListColumns);
      return [1, 2].flatMap((rowNumber) =>
        columns.map((column) => (
          column.key.includes('position')
            ? rowNumber === 1 ? 'North' : 'East'
            : rowNumber === 1 ? 'Market road' : 'Broken bridge'
        ))
      );
    }
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
  fieldKeys: string[],
  fieldDefinitions: TemplateFieldDefinition[] = []
): Record<string, string> => {
  const mapping: Record<string, string> = {};
  headers.forEach((header) => {
    const normalized = header.trim().toLowerCase();
    const indexedStructuredHeader = parseIndexedStructuredHeader(header, fieldDefinitions);
    mapping[header] = indexedStructuredHeader?.fieldKey
      ?? fieldKeys.find((key) => key.toLowerCase() === normalized)
      ?? '';
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
    Object.entries(columnMapping).filter(([header, mappedKey]) => {
      if (mappedKey !== key) return false;
      return !parseIndexedStructuredHeader(header, fieldDefinitions);
    }).length > 1
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

    Object.assign(mappedData, buildBulkMappedData(headers, values, columnMapping, fieldDefinitions, rowOverrides));

    requiredFieldSet.forEach((requiredKey) => {
      const value = mappedData[requiredKey] ?? '';
      if (String(value).trim() === '' || String(value).trim() === '[]') {
        missingRequiredKeys.push(requiredKey);
        warnings.push(`Missing value for ${requiredKey}`);
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

    const rowNumber = i + 1;
    Object.assign(cardData, buildBulkMappedData(headers, values, columnMapping, fieldDefinitions, previewOverrides[rowNumber]));

    generatedCards.push({
      template,
      data: completeCardDataWithTemplateDefaults(fieldDefinitions, cardData),
      uniqueId: createId(rowNumber),
    });
  }

  return generatedCards;
};
