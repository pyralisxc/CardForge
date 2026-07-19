export const isMissingSupabaseTableError = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && (error as { code?: string }).code === 'PGRST205';

export const isMissingSupabaseColumnError = (
  error: unknown,
  columnNames: readonly string[],
): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: string; message?: string };
  if (candidate.code !== 'PGRST204' && candidate.code !== '42703') return false;
  const message = candidate.message?.toLowerCase() ?? '';
  return columnNames.some((columnName) => message.includes(columnName.toLowerCase()));
};
