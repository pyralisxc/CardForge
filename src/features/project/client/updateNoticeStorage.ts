import { acknowledgeUpdateNotices, parseUpdateNoticeReceipts, type UpdateNoticeReceipt, type UpdateNoticeReceipts } from '../model/updateNotices';
import { updateBrowserKeyValue } from '../persistence/indexedDbStorage';
import { readProjectPreferenceSafely } from '../persistence/preferences';
import type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';

const storageKey = (scope: ProjectPersistenceScope) => `update-notice-receipts:v1:${scope}`;

export const readUpdateNoticeReceipts = async (scope: ProjectPersistenceScope): Promise<UpdateNoticeReceipts> => {
  const result = await readProjectPreferenceSafely<unknown>(storageKey(scope));
  if (result.kind === 'unavailable') throw new Error('Notification acknowledgements could not be read. Existing records were kept.');
  return parseUpdateNoticeReceipts(result.kind === 'missing' ? undefined : result.value);
};

export const writeUpdateNoticeAcknowledgement = async (scope: ProjectPersistenceScope, keys: string[], action: UpdateNoticeReceipt): Promise<UpdateNoticeReceipts> => {
  const saved = await updateBrowserKeyValue('project-preferences', storageKey(scope), (raw) => {
    const receipts = acknowledgeUpdateNotices(parseUpdateNoticeReceipts(raw === null ? undefined : JSON.parse(raw)), keys, action);
    const value = { version: 1, receipts };
    parseUpdateNoticeReceipts(value);
    return JSON.stringify(value);
  });
  return parseUpdateNoticeReceipts(JSON.parse(saved));
};
