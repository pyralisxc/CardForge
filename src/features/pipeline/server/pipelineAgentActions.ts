import { getAccountToolAccessForUserId } from '@/features/account/server';
import { hasContributionScope, readContributorCapabilities } from '@/features/contributor-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { consumeRateLimit, RateLimitExceededError } from '@/infrastructure/security/abuseProtection';
import { pipelineAgentExactInput, pipelineAgentListInput, pipelineAgentVoteInput, pipelineAgentHeartInput, pipelineAgentRevision, pipelineAgentHealth } from '../lib/pipelineAgentContract';
import { fetchPipelineSubmissionPage } from '../lib/pipelineProjections';
import { fetchContributorSettings } from '../lib/pipelineStore';
import { getSharedPipelineTrashPage, getPipelineLibraryProgramView } from '../lib/pipelineLibraryStore';
import { recordPipelineSubmissionVote } from '../lib/pipelineStore';
import { getPipelineTrashState } from '../lib/pipelineTrash';
import { setPipelineHeart, PipelineHeartMutationError } from '../lib/pipelineHearts';
import { PipelineStoreError } from '../lib/pipelineStoreError';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import { buildPipelineContentHealth } from '../lib/pipelineContentHealth';
import { getCachedCardForgeCatalog, revalidateCardForgeCatalog } from './catalogCache';
import { readPipelineEngagementForViewer, readVisiblePipelineRevisionForViewer, type PipelineEngagementViewer } from './pipelineEngagement';

const invalid = () => new PipelineStoreError('Provide a supported exact Pipeline request.', 400);
async function viewerFor(actorUserId: string): Promise<PipelineEngagementViewer & { userId: string }> {
  const account = await getAccountToolAccessForUserId(actorUserId);
  const contribution = await readContributorCapabilities(account);
  if (!getSupabaseServerClient()) throw new PipelineStoreError('Pipeline is unavailable.', 503);
  return { userId: account.user.id, accessMode: account.entitlement.accessMode, isOwner: account.isOwner, contribution };
}
function requireScope(viewer: PipelineEngagementViewer, scope: 'assets.submit' | 'assets.review') {
  if (!hasContributionScope(viewer.contribution.scopes, scope)) throw new PipelineStoreError('Your account does not have permission for this Pipeline action.', 403);
}
function project(row: { id: string; lineageId?: string | null; name: string; description: string; assetType: string; status: string; revisionNumber: number | null; trashActorRole?: string | null; publicationRetained?: boolean } & Parameters<typeof getPipelineTrashState>[0], ownedByViewer: boolean) {
  return pipelineAgentRevision.parse({ submissionId: row.id, lineageId: row.lineageId ?? null, name: row.name, description: row.description,
    assetType: row.assetType, status: row.status, revisionNumber: row.revisionNumber, ownedByViewer, trashActorRole: row.trashActorRole ?? null, publicationRetained: row.publicationRetained === true, effectiveTrash: getPipelineTrashState(row) });
}
export async function listAgentPipelineSubmissions(actorUserId: string, input: unknown) {
  const parsed = pipelineAgentListInput.safeParse(input); if (!parsed.success) throw invalid();
  const viewer = await viewerFor(actorUserId); const { scope, ...query } = parsed.data;
  if (scope === 'shared-trash') {
    // Native shared metadata is filtered before count/order/page and never hydrates authored payloads.
    const page = await getSharedPipelineTrashPage(viewer.userId, query);
    return { ...page, items: page.items.map(row => project(row, row.ownedByViewer)) };
  }
  if (scope === 'all' && !viewer.isOwner) throw new PipelineStoreError('Owner access is required for all submissions.', 403);
  requireScope(viewer, scope === 'own' ? 'assets.submit' : 'assets.review');
  const { settings } = await fetchContributorSettings();
  const page = await fetchPipelineSubmissionPage({ currentUserId: viewer.userId, profiles: [], includeRegistryRecipePayloads: false,
    allowSelfVoting: settings.allowContributorSelfVoting, query: { ...query, scope } });
  return { items: page.submissions.map(row => project(row, row.contributorId === viewer.userId)), total: page.total, page: page.page, pageSize: page.pageSize };
}
export async function inspectAgentPipelineRevision(actorUserId: string, input: unknown) {
  const parsed = pipelineAgentExactInput.safeParse(input); if (!parsed.success) throw invalid();
  const viewer = await viewerFor(actorUserId); const row = await readVisiblePipelineRevisionForViewer(parsed.data.submissionId, viewer);
  return project({ id: row.id, lineageId: row.lineage_id, name: row.name, description: row.description ?? '', assetType: row.asset_type ?? '', status: row.status,
    revisionNumber: row.revision_number, trashActorRole: row.revision_trash_actor_role, publicationRetained: row.revision_publication_retained === true || Boolean(row.published_at) || row.catalog_source_published === true, trashedAt: row.trashed_at, purgeAfter: row.purge_after, retentionHold: row.retention_hold,
    catalogTrashedAt: row.catalog_trashed_at, catalogPurgeAfter: row.catalog_purge_after, catalogRetentionHold: row.catalog_retention_hold, catalogSubmissionId: row.catalog_submission_id }, row.contributor_id === viewer.userId);
}
export async function readAgentPipelineEngagement(actorUserId: string, input: unknown) {
  const parsed = pipelineAgentExactInput.safeParse(input); if (!parsed.success) throw invalid();
  return readPipelineEngagementForViewer(parsed.data.submissionId, await viewerFor(actorUserId));
}
export async function readAgentPipelineHealth(actorUserId: string) {
  const viewer = await viewerFor(actorUserId); requireScope(viewer, 'assets.review');
  const [catalog, program] = await Promise.all([getCachedCardForgeCatalog(viewer.accessMode), getPipelineLibraryProgramView(viewer.userId)]);
  const visibleIds = new Set([...program.submissions, ...program.votingQueue].map(row => row.id));
  const health = buildPipelineContentHealth({ catalog, program, dependencyImpacts: program.dependencyImpacts?.filter(row => row.submissionId && visibleIds.has(row.submissionId)) });
  // Technical health only. Editorial review payloads, source notes and authored contracts do not cross this boundary.
  return pipelineAgentHealth.parse({ checkedCount: health.checkedCount, errors: health.errors, warnings: health.warnings, issues: health.issues });
}
const nextAction = 'Read exact engagement before any further write; never retry an uncertain mutation automatically.' as const;
async function limit(action: 'contributor-vote' | 'pipeline-heart', userId: string) {
  const maximum = action === 'contributor-vote' ? 120 : 240;
  const result = await consumeRateLimit({ action, identity: userId, limit: maximum, windowSeconds: 3600 });
  if (!result.allowed) throw new RateLimitExceededError('Too many Pipeline reactions.', result.retryAfterSeconds, { resource: 'pipeline_reactions', maximum, unit: 'attempts_per_hour' });
}
async function afterCommit(submissionId: string, lineageId: string | null, viewer: PipelineEngagementViewer) {
  const warnings: string[] = []; let engagement = null;
  revalidateCardForgeCatalog();
  try { engagement = await readPipelineEngagementForViewer(submissionId, viewer); } catch { warnings.push('engagement_refresh_unavailable'); }
  return { submissionId, lineageId, outcome: 'committed' as const, engagement, warnings, nextAction };
}
export async function voteAgentPipelineRevision(actorUserId: string, input: unknown) {
  const parsed = pipelineAgentVoteInput.safeParse(input); if (!parsed.success) throw invalid();
  const viewer = await viewerFor(actorUserId); requireScope(viewer, 'assets.review');
  const before = await readPipelineEngagementForViewer(parsed.data.submissionId, viewer);
  if (before.voteIssue) throw new PipelineStoreError(before.voteIssue, 403);
  await limit('contributor-vote', viewer.userId);
  try { await recordPipelineSubmissionVote({ ...parsed.data, contributorId: viewer.userId, ownerContributorId: viewer.isOwner ? viewer.userId : null }); }
  catch (error) {
    if ((error instanceof PipelineRegistryCommandError || error instanceof PipelineStoreError) && error.status < 500) throw error;
    return { submissionId: before.submissionId, lineageId: before.lineageId, outcome: 'uncertain' as const, engagement: null, warnings: ['vote_outcome_unconfirmed'], nextAction };
  }
  return afterCommit(before.submissionId, before.lineageId, viewer);
}
export async function heartAgentPipelineLineage(actorUserId: string, input: unknown) {
  const parsed = pipelineAgentHeartInput.safeParse(input); if (!parsed.success) throw invalid();
  const viewer = await viewerFor(actorUserId); const before = await readPipelineEngagementForViewer(parsed.data.submissionId, viewer);
  if (before.lineageId !== parsed.data.lineageId) throw new PipelineStoreError('The exact revision and lineage do not match.', 409);
  if (before.heartIssue) throw new PipelineStoreError(before.heartIssue, 403);
  await limit('pipeline-heart', viewer.userId);
  try {
    const receipt = await setPipelineHeart({ lineageId: parsed.data.lineageId, hearted: parsed.data.hearted, accountId: viewer.userId,
      viewerAccess: viewer.accessMode, contributor: viewer.contribution.active, owner: viewer.isOwner });
    if (receipt.lineageId !== before.lineageId || receipt.hearted !== parsed.data.hearted) throw new Error('Unconfirmed heart receipt');
  } catch (error) {
    if (error instanceof PipelineHeartMutationError && error.status < 500) throw new PipelineStoreError(error.message, error.status);
    return { submissionId: before.submissionId, lineageId: before.lineageId, outcome: 'uncertain' as const, engagement: null, warnings: ['heart_outcome_unconfirmed'], nextAction };
  }
  return afterCommit(before.submissionId, before.lineageId, viewer);
}
