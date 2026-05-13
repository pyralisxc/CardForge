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
