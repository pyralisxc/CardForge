import { hasContributionScope } from '@/features/contributor-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { contributorDraftExactInput, contributorDraftWriteInput, contributorDraftSnapshot, type ContributorDraftReceipt } from '../lib/contributorDraftContract';
import { updatePipelineSubmissionDetails, finalizeContributorTemplatePipelineDraft } from '../lib/pipelineStore';
import { PipelineStoreError } from '../lib/pipelineStoreError';
import { resolvePipelineAgentViewer } from './pipelineAgentActions';
import { revalidateCardForgeCatalog } from './catalogCache';

type Viewer = Awaited<ReturnType<typeof resolvePipelineAgentViewer>>;
const invalid = () => new PipelineStoreError('Provide one exact supported Contributor draft request.', 400);
function requireScope(viewer: Viewer, scope?: 'assets.submit' | 'library.submit') {
  if (!viewer.contribution.active || (scope ? !hasContributionScope(viewer.contribution.scopes, scope) : !hasContributionScope(viewer.contribution.scopes, 'assets.submit') && !hasContributionScope(viewer.contribution.scopes, 'library.submit'))) {
    throw new PipelineStoreError('Your active Contributor profile does not permit this draft action.', 403);
  }
}
async function snapshot(submissionId: string, viewer: Viewer) {
  const db = getSupabaseServerClient(); if (!db) throw new PipelineStoreError('Pipeline is unavailable.', 503);
  const query = db.from('cardforge_contributor_asset_submissions').select('id,contributor_id,lineage_id,revision_number,asset_type,status,name,description,preview_url,source_notes,specialty_tags,use_case_tags,semantic_role,visual_family,variant_kind,variant_label,compatibility_tags,requested_studio_destination,media_presentation').eq('id', submissionId);
  if (!viewer.isOwner) query.eq('contributor_id', viewer.userId);
  const { data: row, error } = await query.maybeSingle();
  if (error) throw new PipelineStoreError('Exact Contributor draft is unavailable.', 503);
  if (!row || row.id !== submissionId || (!viewer.isOwner && row.contributor_id !== viewer.userId)) throw new PipelineStoreError('This exact authorized draft was not found; no sibling was substituted.', 404);
  const canSaveMetadata = hasContributionScope(viewer.contribution.scopes, 'assets.submit') && !['published', 'rejected'].includes(row.status) && row.media_presentation == null;
  const canFinalize = hasContributionScope(viewer.contribution.scopes, 'library.submit') && row.contributor_id === viewer.userId && row.status === 'draft' && row.asset_type === 'templates';
  const parsed = contributorDraftSnapshot.safeParse({ submissionId: row.id, contributorId: row.contributor_id, lineageId: row.lineage_id ?? null, revisionNumber: row.revision_number ?? null, assetType: row.asset_type, status: row.status,
    metadata: { name: row.name, description: row.description ?? '', previewUrl: row.preview_url ?? '', sourceNotes: row.source_notes ?? '', specialtyTags: row.specialty_tags ?? [], useCaseTags: row.use_case_tags ?? [],
      ...(row.semantic_role ? { semanticRole: row.semantic_role } : {}), ...(row.visual_family ? { visualFamily: row.visual_family } : {}), ...(row.variant_kind ? { variantKind: row.variant_kind } : {}), ...(row.variant_label ? { variantLabel: row.variant_label } : {}), compatibilityTags: row.compatibility_tags ?? [], ...(row.requested_studio_destination ? { requestedStudioDestination: row.requested_studio_destination } : {}) },
    canSaveMetadata, canFinalize, unavailableReason: canSaveMetadata || canFinalize ? null : 'This exact revision is not eligible for these editing or finalization actions.' });
  if (!parsed.success) throw new PipelineStoreError('Exact Contributor metadata could not be verified.', 503);
  return parsed.data;
}
export async function getContributorPipelineDraft(actorUserId: string, input: unknown) {
  const parsed = contributorDraftExactInput.safeParse(input); if (!parsed.success) throw invalid();
  const viewer = await resolvePipelineAgentViewer(actorUserId); requireScope(viewer);
  return snapshot(parsed.data.submissionId, viewer);
}
async function change(actorUserId: string, input: unknown, finalize: boolean) {
  const parsed = contributorDraftWriteInput.safeParse(input); if (!parsed.success) throw invalid();
  const viewer = await resolvePipelineAgentViewer(actorUserId); requireScope(viewer, finalize ? 'library.submit' : 'assets.submit');
  // Exact private read and eligibility precede any write; native owners recheck at mutation.
  const before = await snapshot(parsed.data.submissionId, viewer);
  if (finalize && before.contributorId !== viewer.userId) throw new PipelineStoreError('Only the original draft owner can submit this Template.', 403);
  if (!(finalize ? before.canFinalize : before.canSaveMetadata)) throw new PipelineStoreError(before.unavailableReason ?? 'This exact action is not permitted for this draft.', 409);
  let receipt: ContributorDraftReceipt;
  try {
    receipt = finalize ? await finalizeContributorTemplatePipelineDraft({ submissionId: before.submissionId, contributorId: viewer.userId, input: parsed.data.metadata })
      : await updatePipelineSubmissionDetails({ submissionId: before.submissionId, contributorId: viewer.userId, input: parsed.data.metadata, allowOwnerEdit: viewer.isOwner });
  } catch (error) {
    if (error instanceof PipelineStoreError && error.status < 500) throw error;
    receipt = { submissionId: before.submissionId, outcome: 'uncertain', metadataCommitted: null, submitted: null, committedMetadataFields: [], warnings: ['The exact write outcome is unconfirmed.'], retryable: false, nextAction: 'read' };
  }
  let value = null;
  if (receipt.metadataCommitted === true) {
    try { if (!revalidateCardForgeCatalog()) receipt.warnings.push('Catalog refresh is incomplete.'); } catch { receipt.warnings.push('Catalog refresh is incomplete.'); }
  }
  try { value = await snapshot(before.submissionId, viewer); } catch { receipt.warnings.push('Exact metadata readback is unavailable.'); }
  if (receipt.warnings.length || receipt.outcome === 'uncertain' || receipt.outcome === 'metadata_committed_not_submitted') receipt.nextAction = 'read';
  return { snapshot: value, receipt };
}
export const saveContributorPipelineMetadata = (actorUserId: string, input: unknown) => change(actorUserId, input, false);
export const finalizeContributorTemplateSubmission = (actorUserId: string, input: unknown) => change(actorUserId, input, true);
