export type UpdateNoticeReceipt = 'read' | 'dismissed';
export type UpdateNoticeReceipts = Record<string, UpdateNoticeReceipt>;

export const updateNoticeKey = (setId: string, templateId: string, lineageId: string, revisionId: string, fingerprint: string): string => (
  JSON.stringify([setId, templateId, lineageId, revisionId, fingerprint])
);

export const parseUpdateNoticeReceipts = (value: unknown): UpdateNoticeReceipts => {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Notification acknowledgements are unreadable. Existing records were kept.');
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !record.receipts || typeof record.receipts !== 'object' || Array.isArray(record.receipts)
    || Object.keys(record).some((key) => key !== 'version' && key !== 'receipts')) {
    throw new Error('Notification acknowledgements use an unsupported format. Existing records were kept.');
  }
  return Object.fromEntries(Object.entries(record.receipts).map(([key, receipt]) => {
    let parts: unknown;
    try { parts = JSON.parse(key); } catch { throw new Error('Notification identity is unreadable. Existing records were kept.'); }
    if (!Array.isArray(parts) || parts.length !== 5 || parts.some((part) => typeof part !== 'string' || !part)
      || !/^[a-f0-9]{64}$/.test(parts[4]) || (receipt !== 'read' && receipt !== 'dismissed')) {
      throw new Error('Notification acknowledgements are invalid. Existing records were kept.');
    }
    return [key, receipt];
  }));
};

export const acknowledgeUpdateNotices = (receipts: UpdateNoticeReceipts, keys: string[], action: UpdateNoticeReceipt): UpdateNoticeReceipts => ({
  ...receipts,
  ...Object.fromEntries(keys.map((key) => [key, receipts[key] === 'dismissed' ? 'dismissed' : action])),
});
