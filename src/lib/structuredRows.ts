import type { CardData, FreeformCardElement } from '@/types';
import { buildScopedFieldDataKey, resolveTemplateTextSegments } from '@/lib/textBindings';

export type StructuredRowValue = Record<string, string>;

export const STRUCTURED_ROWS_DATA_PREFIX = '__cardforgeStructuredRows__';
export const STRUCTURED_ROWS_SEPARATOR_PREFIX = '__cardforgeStructuredRowsSeparator__';

export const buildStructuredRowsDataKey = (elementId: string): string =>
  `${STRUCTURED_ROWS_DATA_PREFIX}${elementId}`;

export const buildStructuredRowsSeparatorDataKey = (elementId: string): string =>
  `${STRUCTURED_ROWS_SEPARATOR_PREFIX}${elementId}`;

export const parseStructuredRowsValue = (value: CardData[string]): StructuredRowValue[] => {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
      .map((row) => Object.fromEntries(
        Object.entries(row).map(([key, cellValue]) => [key, cellValue === undefined || cellValue === null ? '' : String(cellValue)])
      ));
  } catch {
    return [];
  }
};

export const stringifyStructuredRowsValue = (rows: StructuredRowValue[]): string =>
  JSON.stringify(rows);

export const structuredRowToCardData = (
  elementId: string,
  row: StructuredRowValue,
): CardData => {
  const data: CardData = {};
  Object.entries(row).forEach(([key, value]) => {
    data[key] = value;
    data[buildScopedFieldDataKey(elementId, key)] = value;
  });
  return data;
};

export const buildStructuredRowsText = (
  element: Pick<FreeformCardElement, 'id' | 'content'>,
  rows: StructuredRowValue[],
  separator = '\n',
): string =>
  rows
    .map((row) => resolveTemplateTextSegments(element.id, element.content, structuredRowToCardData(element.id, row), true))
    .filter((rowText) => rowText.trim().length > 0)
    .join(separator);
