import { z } from 'zod/v4';

export const contributorDraftExactInput = z.object({ submissionId: z.uuid() }).strict();
export const contributorMetadataFields = z.object({
  name: z.string().min(1).max(96), description: z.string().max(280).optional(), previewUrl: z.string().max(4096).optional(),
  sourceNotes: z.string().max(600).optional(), specialtyTags: z.array(z.string().max(64)).max(32).optional(), useCaseTags: z.array(z.string().max(64)).max(32).optional(),
  semanticRole: z.string().max(64).optional(), visualFamily: z.string().max(80).optional(), variantKind: z.string().max(64).optional(), variantLabel: z.string().max(80).optional(),
  compatibilityTags: z.array(z.string().max(64)).max(32).optional(), requestedStudioDestination: z.string().max(96).optional(),
}).strict();
export const contributorDraftWriteInput = z.object({ submissionId: z.uuid(), metadata: contributorMetadataFields }).strict();
export const contributorDraftSnapshot = z.object({
  submissionId: z.uuid(), contributorId: z.string(), lineageId: z.string().nullable(), revisionNumber: z.number().int().nullable(),
  assetType: z.string(), status: z.string(), metadata: contributorMetadataFields,
  canSaveMetadata: z.boolean(), canFinalize: z.boolean(), unavailableReason: z.string().nullable(),
}).strict();
export const contributorDraftReceipt = z.object({
  submissionId: z.string(), outcome: z.enum(['committed', 'submitted', 'metadata_committed_not_submitted', 'uncertain']),
  metadataCommitted: z.boolean().nullable(), submitted: z.boolean().nullable(), committedMetadataFields: z.array(z.string()),
  warnings: z.array(z.string()), nextAction: z.enum(['none', 'read']), retryable: z.literal(false),
}).strict();
export const contributorDraftMutationResult = z.object({ snapshot: contributorDraftSnapshot.nullable(), receipt: contributorDraftReceipt }).strict();
export type ContributorDraftReceipt = z.infer<typeof contributorDraftReceipt>;
