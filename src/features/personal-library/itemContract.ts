import { z } from 'zod/v4';
import { PERSONAL_LIBRARY_ROLES } from './model';

export const PERSONAL_LIBRARY_REMOVAL_NOTICE = 'Permanently remove only this CardForge library index entry. The Google Drive original is untouched. There is no index Trash or Undo. Later Picker registration does not restore this exact index identity.';
export const personalLibraryExactInput = z.object({ itemId: z.uuid() }).strict();
export const personalLibraryRemovalInput = personalLibraryExactInput.extend({ confirmation: z.object({ itemId: z.uuid(), notice: z.literal(PERSONAL_LIBRARY_REMOVAL_NOTICE) }).strict() }).strict();
export const personalLibraryItemMetadata = z.object({
  itemId: z.uuid(), provider: z.literal('google-drive'), displayName: z.string().min(1),
  role: z.enum(PERSONAL_LIBRARY_ROLES), mimeType: z.string().min(1), byteSize: z.number().int().positive(),
  providerRevision: z.string().min(1), contentHash: z.string().regex(/^[a-f0-9]{64}$/u).nullable(),
}).strict();
export const personalLibraryItemRead = z.object({ itemId: z.uuid(), item: personalLibraryItemMetadata.nullable() }).strict();
export const personalLibraryRemovalReceipt = z.object({ itemId: z.uuid(), outcome: z.enum(['removed', 'absent', 'uncertain']), committed: z.boolean().nullable(), retryable: z.literal(false), message: z.string() }).strict().refine(value => value.outcome === 'removed' ? value.committed === true : value.outcome === 'absent' ? value.committed === false : value.committed === null, 'Outcome and acknowledgement must agree.');
export type PersonalLibraryRemovalReceipt = z.infer<typeof personalLibraryRemovalReceipt>;
export const uncertainPersonalLibraryRemoval = (itemId: string): PersonalLibraryRemovalReceipt => ({ itemId, outcome: 'uncertain', committed: null, retryable: false, message: 'Removal is not confirmed. Read this exact index entry before any further action. Do not automatically repeat DELETE; absence alone does not prove which operation removed it.' });
