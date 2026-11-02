import { z } from 'zod/v4';

const assetId = z.string().trim().min(1).max(200);
const identity = { assetId, expectedSubmissionId: z.uuid(), expectedLineageId: z.uuid(), expectedRevision: z.number().int().nonnegative() };
const expected = {
  expectedSpecialtyTags: z.array(z.string()).max(12), expectedUseCaseTags: z.array(z.string()).max(12), expectedSemanticRole: z.string().min(1).max(80),
  expectedVisualFamily: z.string().max(80).nullable(), expectedVariantKind: z.string().min(1).max(40), expectedVariantLabel: z.string().max(80).nullable(), expectedCompatibilityTags: z.array(z.string()).max(12),
};
export const publishedClassificationReadInput = z.object({ assetId }).strict();
export const publishedClassificationInput = z.object({ ...identity, ...expected,
  specialtyTags: z.array(z.string()).min(1).max(12), useCaseTags: z.array(z.string()).max(12), semanticRole: z.string().min(1).max(80),
  visualFamily: z.string().max(80).nullable(), variantKind: z.string().min(1).max(40), variantLabel: z.string().max(80).nullable(), compatibilityTags: z.array(z.string()).max(12),
}).strict();
export const publishedClassificationSnapshot = z.object({ ...identity, ...expected, name: z.string(), assetType: z.string() }).strict();
export const publishedClassificationReceipt = z.object({ ...identity, outcome: z.enum(['committed', 'uncertain']), committed: z.literal(true).nullable(),
  refreshComplete: z.boolean(), warnings: z.array(z.string()), retryable: z.literal(false), nextAction: z.enum(['none', 'read']),
}).strict();
export const publishedClassificationResult = z.object({ snapshot: publishedClassificationSnapshot.nullable(), receipt: publishedClassificationReceipt }).strict();
