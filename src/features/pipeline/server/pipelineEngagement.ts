import { getCurrentCardforgeUserAccess, resolveCardforgeEntitlementForAccess } from '@/features/account/server';
import { getContributorCapabilities, hasContributionScope } from '@/features/contributor-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getPipelineVotePolicy } from '../lib/pipelineStore';
import { PipelineStoreError } from '../lib/pipelineStoreError';
import { isContributorPipelineVoteable } from '../lib/pipelineLibrary';
import { isPipelineRevisionVisibleToContributor } from '../lib/pipelineVisibility';
import { getPipelineHeartMetrics, getViewerVisiblePipelineLineageIds, isPipelineLineageId } from '../lib/pipelineHearts';
import { getVisibleRegistryAccessTiers } from '../lib/registryContentAssets';
import type { PipelineEngagement } from '../lib/pipelineEngagement';
import type { PipelineSubmission } from '../lib/pipelineProgram';

export const readPipelineEngagement = async (submissionId: string): Promise<PipelineEngagement> => {
  if (!isPipelineLineageId(submissionId)) throw new PipelineStoreError('Choose an exact Pipeline revision.', 400);
  const access = await getCurrentCardforgeUserAccess();
  const entitlement = await resolveCardforgeEntitlementForAccess(access);
  const contribution = access.user ? await getContributorCapabilities({ user: access.user, entitlement, isOwner: access.ownerAccess.isOwner }) : { active: false, scopes: [] };
  const database = getSupabaseServerClient();
  if (!database) throw new PipelineStoreError('Pipeline reactions are unavailable.', 503);
  // Deliberately excludes authored payloads, source paths and private review evidence.
  const { data, error } = await database.from('cardforge_contributor_asset_submissions')
    .select('id,lineage_id,contributor_id,name,revision_number,status,trashed_at,purge_state,positive_votes,negative_votes')
    .eq('id', submissionId).limit(1);
  if (error) throw new PipelineStoreError('Pipeline reactions are unavailable.', 503);
  const row = data?.[0] as { id: string; lineage_id: string | null; contributor_id: string; name: string; revision_number: number | null; status: PipelineSubmission['status']; trashed_at: string | null; purge_state: 'pending' | null; positive_votes: number; negative_votes: number } | undefined;
  if (!row) throw new PipelineStoreError('This exact Pipeline revision was not found.', 404);
  const contributorVisible = isPipelineRevisionVisibleToContributor({ contributorId: row.contributor_id, status: row.status, purgeState: row.purge_state, viewerId: access.user?.id ?? null, contributor: contribution.active, owner: access.ownerAccess.isOwner });
  if (!contributorVisible) {
    const publication = await database.from('cardforge_discoverable_asset_registry').select('asset_id')
      .eq('contributor_submission_id', submissionId).eq('status', 'published')
      .in('access_tier', getVisibleRegistryAccessTiers(entitlement.accessMode)).limit(1);
    if (publication.error) throw new PipelineStoreError('Pipeline source visibility is unavailable.', 503);
    if (!publication.data?.length || row.trashed_at || row.purge_state) throw new PipelineStoreError('This exact Pipeline revision is not available to your account.', 403);
  }
  const canReview = hasContributionScope(contribution.scopes, 'assets.review');
  const policy = canReview && access.user ? await getPipelineVotePolicy(submissionId, { viewerId: access.user.id, contributor: contribution.active, owner: access.ownerAccess.isOwner }) : null;
  const voteIssue = !access.user ? 'Sign in with Contributor review access to like or dislike.'
    : !canReview ? 'Contributor review access is required to like or dislike.'
      : !policy?.visibleToViewer ? 'This exact revision is not available for review.'
        : !isContributorPipelineVoteable({ status: row.status, trashedAt: row.trashed_at, purgeState: row.purge_state } as PipelineSubmission) ? 'Draft, Trash and purging revisions cannot receive votes.'
          : policy.submissionContributorId === access.user.id && !policy.allowContributorSelfVoting ? 'Contributor self-voting is disabled by the owner.' : null;
  let currentUserVote: PipelineEngagement['currentUserVote'] = null;
  if (canReview && access.user) {
    const vote = await database.from('cardforge_contributor_asset_votes').select('vote_value').eq('submission_id', submissionId).eq('contributor_id', access.user.id).limit(1);
    if (vote.error) throw new PipelineStoreError('Your Pipeline vote is unavailable.', 503);
    const value = vote.data?.[0]?.vote_value;
    currentUserVote = value === 'positive' || value === 'negative' ? value : null;
  }
  const visibleLineages = row.lineage_id ? await getViewerVisiblePipelineLineageIds({ lineageIds: [row.lineage_id], viewerAccess: entitlement.accessMode, contributor: contribution.active, viewerId: access.user?.id ?? null, owner: access.ownerAccess.isOwner }) : [];
  const heart = row.lineage_id && visibleLineages.includes(row.lineage_id) ? (await getPipelineHeartMetrics([row.lineage_id], access.user?.id ?? null))[0] : null;
  return {
    submissionId: row.id, lineageId: row.lineage_id, name: row.name, revisionNumber: row.revision_number,
    status: row.status, trashedAt: row.trashed_at, purgeState: row.purge_state,
    positiveVotes: row.positive_votes, negativeVotes: row.negative_votes, currentUserVote, voteIssue,
    heart: heart ? { count: heart.count, hearted: heart.hearted } : null,
    heartIssue: !heart ? 'This Pipeline lineage is unavailable for hearts.' : !access.user ? 'Sign in to heart Pipeline work.' : null,
  };
};
