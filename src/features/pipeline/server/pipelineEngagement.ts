import { getCurrentCardforgeUserAccess, resolveCardforgeEntitlementForAccess } from '@/features/account/server';
import { getContributorProfileCapabilities, resolveContributorScopes, hasContributionScope } from '@/features/contributor-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getPipelineVotePolicy } from '../lib/pipelineStore';
import { PipelineStoreError } from '../lib/pipelineStoreError';
import { isContributorPipelineVoteable } from '../lib/pipelineLibrary';
import { isSharedPipelineTrash, isPipelineRevisionVisibleToContributor } from '../lib/pipelineVisibility';
import { getPipelineHeartMetrics, getViewerVisiblePipelineLineageIds, isPipelineLineageId } from '../lib/pipelineHearts';
import { getVisibleRegistryAccessTiers } from '../lib/registryContentAssets';
import type { PipelineEngagement } from '../lib/pipelineEngagement';
import type { PipelineSubmission } from '../lib/pipelineProgram';

export const readPipelineEngagement = async (submissionId: string): Promise<PipelineEngagement> => {
  const access = await getCurrentCardforgeUserAccess();
  const entitlement = await resolveCardforgeEntitlementForAccess(access);
  // Panel reads must never enroll or update a Contributor profile.
  const profile = access.user && entitlement.authorities.contributor && !access.ownerAccess.isOwner
    ? await getContributorProfileCapabilities(access.user.id) : null;
  const contribution = {
    active: access.ownerAccess.isOwner || profile?.status === 'active',
    scopes: resolveContributorScopes({ isOwner: access.ownerAccess.isOwner, profileStatus: profile?.status ?? null, canDraftCampaigns: false }),
  };
  return readPipelineEngagementForViewer(submissionId, { userId: access.user?.id ?? null, accessMode: entitlement.accessMode, isOwner: access.ownerAccess.isOwner, contribution });
};

export interface PipelineEngagementViewer {
  userId: string | null; accessMode: import('../lib/registryContentAssets').RegistryViewerAccess;
  isOwner: boolean; contribution: { active: boolean; scopes: readonly import('@/features/contributor-access/server').ContributorScope[] };
}

export const readVisiblePipelineRevisionForViewer = async (submissionId: string, viewer: PipelineEngagementViewer) => {
  if (!isPipelineLineageId(submissionId)) throw new PipelineStoreError('Choose an exact Pipeline revision.', 400);
  const { userId, accessMode, isOwner, contribution } = viewer;
  const database = getSupabaseServerClient();
  if (!database) throw new PipelineStoreError('Pipeline reactions are unavailable.', 503);
  // Deliberately excludes authored payloads, source paths and private review evidence.
  const { data, error } = await database.from('cardforge_pipeline_submission_recovery_projection')
    .select('asset_type,description,updated_at,catalog_source_published,catalog_trashed_at,catalog_purge_after,catalog_retention_hold,catalog_submission_id,purge_after,retention_hold,id,lineage_id,contributor_id,name,revision_number,status,published_at,revision_publication_retained,revision_trash_actor_role,revision_trash_previous_status,trashed_at,purge_state,positive_votes,negative_votes')
    .eq('id', submissionId).limit(1);
  if (error) throw new PipelineStoreError('Pipeline reactions are unavailable.', 503);
  const row = data?.[0] as { catalog_source_published?: boolean; asset_type?: import('../lib/pipelineItems').PipelineType; description?: string; updated_at?: string; catalog_trashed_at?: string | null; catalog_purge_after?: string | null; catalog_retention_hold?: boolean; catalog_submission_id?: string | null; purge_after?: string | null; retention_hold?: boolean; id: string; lineage_id: string | null; contributor_id: string; name: string; revision_number: number | null; status: PipelineSubmission['status']; published_at?: string | null; revision_publication_retained?: boolean; revision_trash_actor_role?: string | null; revision_trash_previous_status?: PipelineSubmission['status'] | null; trashed_at: string | null; purge_state: 'pending' | null; positive_votes: number; negative_votes: number } | undefined;
  if (row && row.id !== submissionId) throw new PipelineStoreError('Exact Pipeline identity is unconfirmed.', 503);
  if (!row) throw new PipelineStoreError('This exact Pipeline revision was not found.', 404);
  const contributorVisible = isPipelineRevisionVisibleToContributor({ contributorId: row.contributor_id, status: row.status, trashPreviousStatus: row.revision_trash_previous_status, publicationRetained: row.revision_publication_retained || row.catalog_source_published, publishedAt: row.published_at, trashActorRole: row.revision_trash_actor_role, trashedAt: row.trashed_at, purgeState: row.purge_state, viewerId: userId, contributor: contribution.active, owner: isOwner });
  const sharedTrashVisible = Boolean(userId && !row.purge_state && row.status !== 'draft' && (row.trashed_at || row.catalog_trashed_at) && isSharedPipelineTrash({ status: row.status, trashedAt: row.trashed_at, catalogTrashedAt: row.catalog_trashed_at, publicationRetained: row.revision_publication_retained || row.catalog_source_published, publishedAt: row.published_at, trashActorRole: row.revision_trash_actor_role, trashPreviousStatus: row.revision_trash_previous_status }));
  if (!contributorVisible && !sharedTrashVisible) {
    const publication = await database.from('cardforge_discoverable_asset_registry').select('asset_id')
      .eq('contributor_submission_id', submissionId).eq('status', 'published')
      .in('access_tier', getVisibleRegistryAccessTiers(accessMode)).limit(1);
    if (publication.error) throw new PipelineStoreError('Pipeline source visibility is unavailable.', 503);
    if (!publication.data?.length || row.trashed_at || row.purge_state) throw new PipelineStoreError('This exact Pipeline revision is not available to your account.', 403);
  }
  return row;
};

export const readPipelineEngagementForViewer = async (submissionId: string, viewer: PipelineEngagementViewer): Promise<PipelineEngagement> => {
  const { userId, accessMode, isOwner, contribution } = viewer;
  const row = await readVisiblePipelineRevisionForViewer(submissionId, viewer);
  const database = getSupabaseServerClient();
  if (!database) throw new PipelineStoreError('Pipeline reactions are unavailable.', 503);
  const canReview = hasContributionScope(contribution.scopes, 'assets.review');
  const policy = canReview && userId ? await getPipelineVotePolicy(submissionId, { viewerId: userId, contributor: contribution.active, owner: isOwner }) : null;
  const voteIssue = !userId ? 'Sign in with Contributor review access to like or dislike.'
    : !canReview ? 'Contributor review access is required to like or dislike.'
      : !policy?.visibleToViewer ? 'This exact revision is not available for review.'
        : !isContributorPipelineVoteable({ status: row.status, trashPreviousStatus: row.revision_trash_previous_status, publicationRetained: row.revision_publication_retained || row.catalog_source_published, publishedAt: row.published_at, trashActorRole: row.revision_trash_actor_role, trashedAt: row.trashed_at, purgeState: row.purge_state } as PipelineSubmission) ? 'Private drafts and purging revisions cannot receive votes.'
          : policy.submissionContributorId === userId && !policy.allowContributorSelfVoting ? 'Contributor self-voting is disabled by the owner.' : null;
  let currentUserVote: PipelineEngagement['currentUserVote'] = null;
  if (canReview && userId) {
    const vote = await database.from('cardforge_contributor_asset_votes').select('vote_value').eq('submission_id', submissionId).eq('contributor_id', userId).limit(1);
    if (vote.error) throw new PipelineStoreError('Your Pipeline vote is unavailable.', 503);
    const value = vote.data?.[0]?.vote_value;
    currentUserVote = value === 'positive' || value === 'negative' ? value : null;
  }
  const visibleLineages = row.lineage_id ? await getViewerVisiblePipelineLineageIds({ lineageIds: [row.lineage_id], viewerAccess: accessMode, contributor: contribution.active, viewerId: userId, owner: isOwner }) : [];
  const heart = row.lineage_id && visibleLineages.includes(row.lineage_id) ? (await getPipelineHeartMetrics([row.lineage_id], userId))[0] : null;
  return {
    submissionId: row.id, lineageId: row.lineage_id, name: row.name, revisionNumber: row.revision_number,
    status: row.status, trashedAt: row.trashed_at, purgeState: row.purge_state,
    positiveVotes: row.positive_votes, negativeVotes: row.negative_votes, currentUserVote, voteIssue,
    heart: heart ? { count: heart.count, hearted: heart.hearted } : null,
    heartIssue: !heart ? 'This Pipeline lineage is unavailable for hearts.' : !userId ? 'Sign in to heart Pipeline work.' : null,
  };
};
