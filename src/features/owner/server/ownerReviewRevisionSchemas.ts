import { z } from 'zod/v4';

export const reviewRevisionReadInput = z.object({ assetId: z.string().trim().min(1).max(200) }).strict();
export const reviewRevisionReceiptInput = reviewRevisionReadInput.extend({ submissionKey: z.string().regex(/^[A-Za-z0-9_-]{16,160}$/u) }).strict();
export const reviewRevisionBase = z.object({ assetId: z.string().trim().min(1).max(200), parentSubmissionId: z.uuid(), lineageId: z.uuid(),
  baseRevisionNumber: z.number().int().positive(), revisionHighWater: z.number().int().positive(), parentContentVersion: z.string().regex(/^[a-f0-9]{32}$/u), registryContentVersion: z.string().regex(/^[a-f0-9]{32}$/u) }).strict();
// Transport describes the existing payload envelope. Native repository validators remain authoritative for full authored content.
export const reviewTemplatePayload = z.object({ id: z.string().trim().min(1), name: z.string().trim().min(1), aspectRatio: z.string().trim().min(1) }).catchall(z.unknown());
export const reviewStylePayload = z.object({ id: z.string().trim().min(1), name: z.string().trim().min(1), kind: z.string().trim().min(1), targets: z.array(z.string().trim().min(1)), appearance: z.record(z.string(), z.unknown()) }).catchall(z.unknown());
export const reviewRevisionNativeReceipt = z.object({ id: z.uuid(), assetId: z.string(), revisionNumber: z.number().int().positive(), status: z.string(), editorialReviewStatus: z.string(), requestFingerprint: z.string() });
export const reviewRevisionResult = z.object({ assetId: z.string(), submissionKey: z.string(), receipt: reviewRevisionNativeReceipt.nullable(), outcome: z.enum(['committed', 'uncertain']), committed: z.literal(true).nullable(), activityRecorded: z.boolean().nullable(), warnings: z.array(z.string()), retryable: z.literal(false), nextAction: z.enum(['none', 'read']) }).strict();
