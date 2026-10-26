import { createHash } from 'node:crypto';
import { z } from 'zod';
import { isRepositoryTemplate } from './registryContentValidation';
import { templateReviewBaseSchema } from './templateReview';

export const exactCandidateIdentitySchema = z.object({
  submissionId: z.string().uuid(),
  lineageId: z.string().uuid(),
  assetId: z.string().trim().min(1).max(200),
  revisionNumber: z.number().int().positive(),
  baseRevisionNumber: z.number().int().positive(),
  publishedBase: templateReviewBaseSchema,
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();
export type ExactCandidateIdentity = z.infer<typeof exactCandidateIdentitySchema>;

/** Candidate content is never substituted with the current published registry payload. */
export function verifyExactCandidateSnapshot(input: {
  submission: {
    id: string; lineage_id: string | null; target_registry_asset_id: string | null;
    revision_number: number | null; base_revision_number: number | null;
    asset_type: string; status: string; published_at: string | null;
    purge_state: string | null; trashed_at: string | null;
    source_payload: unknown; template_review_context: unknown;
  };
  expected: ExactCandidateIdentity;
}) {
  const { submission: s, expected } = input;
  const parsed = exactCandidateIdentitySchema.safeParse(expected);
  if (!parsed.success) throw new Error('candidate_identity_invalid');
  if (s.id !== expected.submissionId || s.lineage_id !== expected.lineageId
    || s.target_registry_asset_id !== expected.assetId
    || s.revision_number !== expected.revisionNumber
    || s.base_revision_number !== expected.baseRevisionNumber) throw new Error('candidate_identity_changed');
  if (s.asset_type !== 'templates' || !['submitted', 'voting', 'publish_candidate'].includes(s.status) || s.published_at !== null
    || s.purge_state !== null || s.trashed_at !== null) throw new Error('candidate_not_pending');
  if (!isRepositoryTemplate(s.source_payload) || s.source_payload.id !== expected.assetId)
    throw new Error('candidate_payload_unavailable');
  const context = s.template_review_context;
  if (!context || typeof context !== 'object' || Array.isArray(context))
    throw new Error('candidate_base_unavailable');
  const base = templateReviewBaseSchema.safeParse((context as { expectedBase?: unknown }).expectedBase);
  if (!base.success || base.data.assetId !== expected.assetId || base.data.lineageId !== expected.lineageId
    || base.data.baseRevisionNumber !== expected.baseRevisionNumber
    || expected.revisionNumber <= base.data.revisionHighWater) throw new Error('candidate_base_conflict');
  if (JSON.stringify(base.data) !== JSON.stringify(templateReviewBaseSchema.parse(expected.publishedBase))) throw new Error('candidate_base_conflict');
  const digest = createHash('sha256').update(JSON.stringify(s.source_payload)).digest('hex');
  if (digest !== expected.sourceSha256) throw new Error('candidate_payload_changed');
  return { identity: expected, expectedBase: base.data, template: s.source_payload };
}

export function verifyExactCandidatePublishedBase(expected: ExactCandidateIdentity, current: unknown) {
  const live = templateReviewBaseSchema.parse(current);
  if (JSON.stringify({ ...live, revisionHighWater: expected.publishedBase.revisionHighWater }) !== JSON.stringify(templateReviewBaseSchema.parse(expected.publishedBase))
    || live.revisionHighWater !== expected.revisionNumber) throw new Error('candidate_base_changed');
}

export type ExactCandidateSpecimen = ReturnType<typeof verifyExactCandidateSnapshot> & { hydratedSha256: string };
