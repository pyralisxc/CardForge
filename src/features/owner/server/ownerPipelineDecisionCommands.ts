import { z } from 'zod';
import { getAccountToolAccessForUserId } from '@/features/account/server';
import { recordOwnerActivity } from './ownerActivityStore';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { commitPipelineEditorialReview, commitPipelineSubmissionStatus, getPipelineProgramView, PipelineStoreError, PipelineRegistryCommandError, mapPipelineSubmissionRow, type PipelineSubmissionRow, getSourceReviewVersion, CONTENT_QUALITY_AI, CONTENT_QUALITY_BY_ROLE, CONTENT_QUALITY_FINISH, CONTENT_QUALITY_STANDARD_VERSION, CONTENT_QUALITY_UNIVERSAL, PIPELINE_STATUSES, PIPELINE_TYPES, revalidateCardForgeCatalog, readSourceReviewEvidence, recordSourceReviewEvidence, ownerPipelineExactInput, ownerPipelineEvidenceInput, ownerPipelineEditorialInput, ownerPipelinePublicationInput, ownerPipelineEditorialSnapshot, ownerPipelinePublicationSnapshot, type ownerPipelineDecisionReceipt } from '@/features/pipeline/server';
import type { z as z4 } from 'zod/v4';

type Receipt = z4.infer<typeof ownerPipelineDecisionReceipt>;
const invalid = () => new PipelineRegistryCommandError('Provide one exact supported Pipeline decision request.', 400);
async function owner(actorUserId: string) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new PipelineRegistryCommandError('Owner access is required.', 403);
  return access;
}
const rowSchema = z.object({ id: z.string().uuid(), lineage_id: z.string().uuid().nullable(), name: z.string(), asset_type: z.enum(PIPELINE_TYPES), semantic_role: z.string().nullable(), requested_studio_destination: z.string().nullable(), revision_number: z.number().int().nonnegative().nullable(), status: z.enum(PIPELINE_STATUSES), updated_at: z.string().min(1), editorial_review_status: z.enum(['pending','approved','revise','quarantine','retire']).nullable(), editorial_review_note: z.string().nullable(), editorial_reviewed_by: z.string().nullable(), editorial_reviewed_at: z.string().nullable(), source_review_evidence: z.unknown().refine(value => value !== undefined), catalog_submission_id: z.string().uuid().nullable(), published_at: z.string().nullable(), owner_status_override: z.enum(PIPELINE_STATUSES).nullable(), owner_access_tier_override: z.enum(['hidden','free','paid']).nullable(), owner_note: z.string().nullable(), calculated_access_tier: z.enum(['hidden','free','paid','contributor']) });
async function exactRow(submissionId: string) {
  const db = getSupabaseServerClient(); if (!db) throw new PipelineRegistryCommandError('Exact Pipeline review is unavailable.', 503);
  const { data, error } = await db.from('cardforge_pipeline_submission_recovery_projection').select('id,lineage_id,name,asset_type,semantic_role,requested_studio_destination,revision_number,status,updated_at,editorial_review_status,editorial_review_note,editorial_reviewed_by,editorial_reviewed_at,source_review_evidence,catalog_submission_id,published_at,owner_status_override,owner_access_tier_override,owner_note,calculated_access_tier').eq('id', submissionId).maybeSingle();
  if (error) throw new PipelineRegistryCommandError('Exact Pipeline review is unavailable.', 503);
  if (!data) throw new PipelineRegistryCommandError('This exact revision was not found; no sibling was substituted.', 404);
  const parsed = rowSchema.safeParse(data);
  if (!parsed.success || parsed.data.id !== submissionId) throw new PipelineRegistryCommandError('Exact Pipeline state could not be verified.', 503);
  return parsed.data;
}
const identity = (row: z.infer<typeof rowSchema>) => ({ submissionId: row.id, lineageId: row.lineage_id, name: row.name, revisionNumber: row.revision_number, status: row.status, updatedAt: row.updated_at });
async function editorialSnapshot(submissionId: string) {
  const row = await exactRow(submissionId), evidenceVersion = getSourceReviewVersion(row.source_review_evidence);
  if (evidenceVersion === null) throw new PipelineRegistryCommandError('Source evidence is unavailable; no version was inferred.', 503);
  // Use the same semantic-role normalization and quality owner as the browser.
  const submission = mapPipelineSubmissionRow(row as unknown as PipelineSubmissionRow);
  return ownerPipelineEditorialSnapshot.parse({ ...identity(row), reviewStatus: submission.editorialReviewStatus, reviewNote: submission.editorialReviewNote, reviewedBy: row.editorial_reviewed_by, reviewedAt: row.editorial_reviewed_at, evidenceVersion,
    qualityStandard: { version: CONTENT_QUALITY_STANDARD_VERSION, role: submission.semanticRole, universal: [...CONTENT_QUALITY_UNIVERSAL], ai: [...CONTENT_QUALITY_AI], finish: [...CONTENT_QUALITY_FINISH], roleCriteria: CONTENT_QUALITY_BY_ROLE[submission.semanticRole] } });
}
async function publicationSnapshot(submissionId: string) {
  const row = await exactRow(submissionId);
  return ownerPipelinePublicationSnapshot.parse({ ...identity(row), currentPublicationSubmissionId: row.catalog_submission_id, publishedAt: row.published_at, ownerStatusOverride: row.owner_status_override, ownerAccessTierOverride: row.owner_access_tier_override, ownerNote: row.owner_note ?? '', calculatedAccessTier: row.calculated_access_tier });
}
export async function getOwnerPipelineSourceReviewEvidence(actorUserId: string, input: unknown) {
  const parsed = ownerPipelineExactInput.safeParse(input); if (!parsed.success) throw invalid(); await owner(actorUserId);
  const snapshot = await readSourceReviewEvidence(parsed.data.submissionId);
  if (snapshot.submissionId !== parsed.data.submissionId) throw new PipelineRegistryCommandError('Exact evidence identity is unconfirmed.', 503);
  return snapshot;
}
export async function getOwnerPipelineEditorialReview(actorUserId: string, input: unknown) {
  const parsed = ownerPipelineExactInput.safeParse(input); if (!parsed.success) throw invalid(); await owner(actorUserId); return editorialSnapshot(parsed.data.submissionId);
}
export async function getOwnerPipelinePublicationDecision(actorUserId: string, input: unknown) {
  const parsed = ownerPipelineExactInput.safeParse(input); if (!parsed.success) throw invalid(); await owner(actorUserId); return publicationSnapshot(parsed.data.submissionId);
}
/** Shared browser/MCP command seam. A confirmed native commit cannot be undone by post-commit observers. */
async function decide<T>({ actorUserId, submissionId, action, summary, write, read, includeProgram = false, invalidate = true, targetType = 'contributor_asset_revision' }: {
  actorUserId: string; submissionId: string; action: 'library.asset.source_evidence' | 'library.asset.editorial_review' | 'library.asset.override'; summary: string;
  targetType?: 'contributor_asset_revision' | 'contributor_asset';
  write: (actor: Awaited<ReturnType<typeof owner>>) => Promise<T | void>; read: () => Promise<T>; includeProgram?: boolean; invalidate?: boolean;
}) {
  const access = await owner(actorUserId); let snapshot: T | null = null;
  try { snapshot = (await write(access)) ?? null; }
  catch (error) {
    if ((error instanceof PipelineStoreError || error instanceof PipelineRegistryCommandError) && error.status < 500) throw error;
    const receipt: Receipt = { submissionId, outcome: 'uncertain', committed: null, refreshComplete: false, refreshFailures: [], activityRecorded: null, retryable: false, nextAction: 'read', message: 'The native decision outcome is unconfirmed. Read the exact revision/evidence before any further write; do not replay automatically.' };
    return { snapshot: null, program: null, receipt };
  }
  const refreshFailures: string[] = []; let activityRecorded = false;
  if (invalidate) { try { if (!revalidateCardForgeCatalog()) refreshFailures.push('catalog_cache'); } catch { refreshFailures.push('catalog_cache'); } }
  try { activityRecorded = Boolean(await recordOwnerActivity({ actorUserId: access.user.id, actorEmail: access.email, action, targetType, targetId: submissionId, summary })); } catch { /* Commit remains authoritative. */ }
  if (!snapshot) { try { snapshot = await read(); } catch { refreshFailures.push('exact_readback'); } }
  let program = null;
  if (includeProgram) { try { program = await getPipelineProgramView(access.user.id, [access.user.id], { includeRegistryRecipePayloads: true }); } catch { refreshFailures.push('program_refresh'); } }
  const receipt: Receipt = { submissionId, outcome: 'committed', committed: true, refreshComplete: refreshFailures.length === 0, refreshFailures, activityRecorded, retryable: false, nextAction: refreshFailures.length || !activityRecorded ? 'read' : 'none', message: refreshFailures.length || !activityRecorded ? 'Decision committed. Follow-up refresh or activity is incomplete; read current state rather than repeating the write.' : 'Decision committed and read back.' };
  return { snapshot, program, receipt };
}
export async function recordOwnerPipelineSourceReviewEvidence(actorUserId: string, input: unknown) {
  const parsed = ownerPipelineEvidenceInput.safeParse(input); if (!parsed.success) throw invalid(); const { submissionId, ...evidence } = parsed.data;
  return decide({ actorUserId, submissionId, action: 'library.asset.source_evidence', summary: 'Recorded correction-review source observations without changing inherited source claims, artwork or publication.', invalidate: false,
    write: access => recordSourceReviewEvidence(submissionId, evidence, access.user.id), read: () => readSourceReviewEvidence(submissionId) });
}
export async function saveOwnerPipelineEditorialReview(actorUserId: string, input: unknown, options: { includeProgram?: boolean } = {}) {
  const parsed = ownerPipelineEditorialInput.safeParse(input); if (!parsed.success) throw invalid(); const { submissionId, ...decision } = parsed.data;
  return decide({ actorUserId, submissionId, ...options, action: 'library.asset.editorial_review', summary: `Recorded editorial review outcome: ${decision.reviewStatus}.`,
    write: access => commitPipelineEditorialReview({ submissionId, ...decision, currentUserId: access.user.id }), read: () => editorialSnapshot(submissionId) });
}
export async function saveOwnerPipelinePublicationOverride(actorUserId: string, input: unknown, options: { includeProgram?: boolean } = {}) {
  const parsed = ownerPipelinePublicationInput.safeParse(input); if (!parsed.success) throw invalid(); const { submissionId, ...decision } = parsed.data;
  return decide({ actorUserId, submissionId, ...options, targetType: 'contributor_asset', action: 'library.asset.override', summary: 'Updated an Owner publication or access-tier override for an exact shared Library revision.',
    write: access => commitPipelineSubmissionStatus({ submissionId, ...decision, currentUserId: access.user.id }), read: () => publicationSnapshot(submissionId) });
}
