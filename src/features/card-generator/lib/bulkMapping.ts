import type { TemplateFieldDefinition } from '@/domain/templates';

type InitialColumnMappingField = Pick<TemplateFieldDefinition, 'key' | 'label'>;

const getInitialMappingFields = (
  fieldKeysOrDefinitions: string[] | InitialColumnMappingField[]
): InitialColumnMappingField[] => fieldKeysOrDefinitions.map((field) => (
  typeof field === 'string'
    ? { key: field, label: field }
    : field
));

export const buildInitialColumnMapping = (
  headers: string[],
  fieldKeysOrDefinitions: string[] | InitialColumnMappingField[]
): Record<string, string> => {
  const fields = getInitialMappingFields(fieldKeysOrDefinitions);
  const mapping: Record<string, string> = {};
  headers.forEach((header) => {
    const normalized = normalizeMappingToken(header);
    const matchingField = fields.find((field) => (
      normalizeMappingToken(field.key) === normalized
      || normalizeMappingToken(field.label) === normalized
    ));
    mapping[header] = matchingField?.key ?? '';
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

const normalizeMappingToken = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export const getUnmappedRequiredFieldKeys = (
  fieldDefinitions: TemplateFieldDefinition[],
  columnMapping: Record<string, string>
): string[] => {
  const mappedFieldKeys = new Set(
    Object.values(columnMapping)
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
  );

  return fieldDefinitions
    .filter((field) => field.required && !mappedFieldKeys.has(field.key))
    .map((field) => field.key);
};

export const autoMapRequiredFields = (
  headers: string[],
  fieldDefinitions: TemplateFieldDefinition[],
  currentMapping: Record<string, string>
): Record<string, string> => {
  const nextMapping = { ...currentMapping };
  const mappedFieldKeys = new Set(
    Object.values(nextMapping)
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
  );

  fieldDefinitions
    .filter((field) => field.required && !mappedFieldKeys.has(field.key))
    .forEach((field) => {
      const fieldTokens = new Set([
        normalizeMappingToken(field.key),
        normalizeMappingToken(field.label),
      ]);
      field.label
        .split(/\s+/)
        .map(normalizeMappingToken)
        .filter((token) => token.length >= 3)
        .forEach((token) => fieldTokens.add(token));
      const matchingHeader = headers.find((header) => (
        !nextMapping[header]
        && fieldTokens.has(normalizeMappingToken(header))
      ));
      if (!matchingHeader) return;
      nextMapping[matchingHeader] = field.key;
      mappedFieldKeys.add(field.key);
    });

  return nextMapping;
};

export const resolveDuplicateFieldMapping = (
  currentMapping: Record<string, string>,
  fieldKey: string
): Record<string, string> => {
  let foundFirst = false;
  const nextMapping: Record<string, string> = {};

  Object.entries(currentMapping).forEach(([header, mappedKey]) => {
    if (mappedKey !== fieldKey) {
      nextMapping[header] = mappedKey;
      return;
    }
    if (!foundFirst) {
      nextMapping[header] = mappedKey;
      foundFirst = true;
      return;
    }
    nextMapping[header] = '';
  });

  return nextMapping;
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
