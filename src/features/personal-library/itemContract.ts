import { z } from 'zod/v4';
import { MAX_PERSONAL_LIBRARY_ITEM_BYTES, MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT, PERSONAL_LIBRARY_ROLES } from './model';

export const PERSONAL_LIBRARY_REMOVAL_NOTICE = 'Permanently remove only this CardForge library index entry. The Google Drive original is untouched. There is no index Trash or Undo. Later Picker registration does not restore this exact index identity.';
export const personalLibraryExactInput = z.object({ itemId: z.uuid() }).strict();
export const personalLibraryRemovalInput = personalLibraryExactInput.extend({ confirmation: z.object({ itemId: z.uuid(), notice: z.literal(PERSONAL_LIBRARY_REMOVAL_NOTICE) }).strict() }).strict();
// Match PostgreSQL char_length(btrim(text)): ordinary spaces and Unicode code points.
const storedTextLength = (value: string) => { let start = 0; let end = value.length; while (value[start] === ' ') start++; while (end > start && value[end - 1] === ' ') end--; return Array.from(value.slice(start, end)).length; };
const storedText = (maximum: number) => z.string().refine(value => { const length = storedTextLength(value); return length >= 1 && length <= maximum; });
export const personalLibraryItemMetadata = z.object({
  itemId: z.uuid(), provider: z.literal('google-drive'), displayName: storedText(320),
  role: z.enum(PERSONAL_LIBRARY_ROLES), mimeType: storedText(160), byteSize: z.number().int().min(0).max(MAX_PERSONAL_LIBRARY_ITEM_BYTES),
  providerRevision: storedText(80), contentHash: z.string().regex(/^[a-f0-9]{64}$/u).nullable(),
}).strict();
export const personalLibraryItemRead = z.object({ itemId: z.uuid(), item: personalLibraryItemMetadata.nullable() }).strict();
export const personalLibraryRemovalReceipt = z.object({ itemId: z.uuid(), outcome: z.enum(['removed', 'absent', 'uncertain']), committed: z.boolean().nullable(), retryable: z.literal(false), message: z.string() }).strict().refine(value => value.outcome === 'removed' ? value.committed === true : value.outcome === 'absent' ? value.committed === false : value.committed === null, 'Outcome and acknowledgement must agree.');
export type PersonalLibraryRemovalReceipt = z.infer<typeof personalLibraryRemovalReceipt>;
export const uncertainPersonalLibraryRemoval = (itemId: string): PersonalLibraryRemovalReceipt => ({ itemId, outcome: 'uncertain', committed: null, retryable: false, message: 'Removal is not confirmed. Read this exact index entry before any further action. Do not automatically repeat DELETE; absence alone does not prove which operation removed it.' });

export const personalLibraryClientItem = personalLibraryItemMetadata.omit({ itemId: true }).extend({
  id: z.uuid(), providerFileId: storedText(255).refine(value => storedTextLength(value) >= 8),
  providerModifiedAt: z.string().min(1), providerWebViewLink: z.string().nullable(),
  lastVerifiedAt: z.string().min(1), createdAt: z.string().min(1), updatedAt: z.string().min(1),
}).strict();
export const personalLibraryListResult = z.object({ items: z.array(personalLibraryClientItem).max(MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT), count: z.number().int().nonnegative(), limit: z.literal(MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT) }).strict().refine(value => value.count >= value.items.length && (value.items.length === value.limit || value.count === value.items.length) && new Set(value.items.map(item => item.id)).size === value.items.length, 'Invalid observed Library list/count.');
