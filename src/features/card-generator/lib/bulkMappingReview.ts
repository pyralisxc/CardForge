export interface BulkHeaderRowIdentity {
  key: string;
  inputId: string;
  label: string;
}

const sanitizeForId = (value: string): string => (
  value
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'column'
);

export const getBulkHeaderRowIdentity = (header: string, index: number): BulkHeaderRowIdentity => ({
  key: `${header}-${index}`,
  inputId: `mapping-${index}-${sanitizeForId(header)}`,
  label: header,
});
