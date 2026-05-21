import type { StructuredListColumn } from '@/types';

export interface StructuredListRow {
  id: string;
  values: Record<string, string>;
}

export const DEFAULT_STRUCTURED_LIST_COLUMNS: StructuredListColumn[] = [
  { key: 'position', label: 'Position', placeholder: 'North' },
  { key: 'description', label: 'Description', placeholder: 'Leads to the market.' },
];
export const DEFAULT_STRUCTURED_LIST_COLUMN_SEPARATOR = ' - ';
export const DEFAULT_STRUCTURED_LIST_ROW_SEPARATOR = '\n';

const cleanColumnKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'value';

export const normalizeStructuredListColumns = (columns?: StructuredListColumn[]): StructuredListColumn[] => {
  const normalized = (columns || [])
    .map((column) => ({
      key: cleanColumnKey(column.key || column.label),
      label: (column.label || column.key || '').trim(),
      placeholder: column.placeholder?.trim() || undefined,
    }))
    .filter((column) => column.key && column.label);

  return normalized.length > 0 ? normalized : DEFAULT_STRUCTURED_LIST_COLUMNS;
};

export const columnsFromCommaSeparatedLabels = (value: string): StructuredListColumn[] =>
  normalizeStructuredListColumns(
    value
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label) => ({ key: cleanColumnKey(label), label }))
  );

export const createStructuredListRow = (columns: StructuredListColumn[]): StructuredListRow => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `row-${Date.now()}`,
  values: normalizeStructuredListColumns(columns).reduce<Record<string, string>>((acc, column) => {
    acc[column.key] = '';
    return acc;
  }, {}),
});

export const parseStructuredListValue = (value: unknown, columns?: StructuredListColumn[]): StructuredListRow[] => {
  const normalizedColumns = normalizeStructuredListColumns(columns);
  if (Array.isArray(value)) {
    return value.map((row, index) => ({
      id: typeof row?.id === 'string' ? row.id : `row-${index + 1}`,
      values: normalizedColumns.reduce<Record<string, string>>((acc, column) => {
        acc[column.key] = String(row?.values?.[column.key] ?? row?.[column.key] ?? '');
        return acc;
      }, {}),
    }));
  }

  const raw = String(value ?? '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return parseStructuredListValue(parsed, normalizedColumns);
  } catch {
    return raw.split(/\r?\n/).filter(Boolean).map((line, index) => {
      const [first = '', ...rest] = line.split(/\s[-:]\s/);
      return {
        id: `row-${index + 1}`,
        values: normalizedColumns.reduce<Record<string, string>>((acc, column, columnIndex) => {
          acc[column.key] = columnIndex === 0 ? first.trim() : rest.join(' - ').trim();
          return acc;
        }, {}),
      };
    });
  }
};

export const serializeStructuredListRows = (rows: StructuredListRow[]): string =>
  JSON.stringify(rows.map((row) => ({ id: row.id, values: row.values })));

export const decodeStructuredListFormatText = (value: string | undefined, fallback: string): string => {
  const source = typeof value === 'string' && value.trim() ? value : fallback;
  return source.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
};

export const buildStructuredListRowSeparatorText = (
  rowSeparatorText?: string,
  rowSeparator?: string
): string => {
  if (typeof rowSeparatorText === 'string') {
    const trimmed = rowSeparatorText.trim();
    return trimmed ? `\n${trimmed}\n` : DEFAULT_STRUCTURED_LIST_ROW_SEPARATOR;
  }

  return decodeStructuredListFormatText(rowSeparator, DEFAULT_STRUCTURED_LIST_ROW_SEPARATOR);
};

export const buildStructuredListDefaultRowTemplate = (columns?: StructuredListColumn[]): string =>
  normalizeStructuredListColumns(columns)
    .map((column) => `{{${column.key}}}`)
    .join(' - ');

const formatStructuredListRow = (
  row: StructuredListRow,
  columns: StructuredListColumn[],
  rowTemplate?: string
): string => {
  const fallback = buildStructuredListDefaultRowTemplate(columns);
  const template = decodeStructuredListFormatText(rowTemplate, fallback);
  const populated = template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) =>
    row.values[key]?.trim() || ''
  );

  return populated.replace(/[ \t]+\n/g, '\n').trim();
};

export const formatStructuredListRows = (
  value: unknown,
  columns?: StructuredListColumn[],
  rowTemplate?: string,
  rowSeparator?: string
): string => {
  const normalizedColumns = normalizeStructuredListColumns(columns);
  const separator = buildStructuredListRowSeparatorText(undefined, rowSeparator);

  return parseStructuredListValue(value, normalizedColumns)
    .map((row) => formatStructuredListRow(row, normalizedColumns, rowTemplate))
    .filter(Boolean)
    .join(separator);
};
