import { parseCSV } from '@/features/card-generator/lib/csv';
import type { BulkDataSourceHint } from '@/features/card-generator/lib/bulkContracts';

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
const STRUCTURED_TEXT_LIST_PREFIX_REGEX = /^\s*(?:[-*]\s+|\d+[\.)]\s+)/;

const stripStructuredTextListPrefix = (line: string): string =>
  line.replace(STRUCTURED_TEXT_LIST_PREFIX_REGEX, '');

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
    const normalizedLine = stripStructuredTextListPrefix(line);
    const fieldMatch = FIELD_LINE_REGEX.exec(normalizedLine);
    if (fieldMatch) {
      const key = fieldMatch[1].trim();
      if (!key) return;
      if (Object.prototype.hasOwnProperty.call(currentRecord, key)) {
        pushStructuredRecord(records, currentRecord, activeKeyRef);
      }
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
