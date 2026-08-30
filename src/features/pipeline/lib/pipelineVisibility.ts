import type { PipelineStatus } from './pipelineItems';

const CONTRIBUTOR_HIDDEN_STATUSES = new Set<PipelineStatus>(['draft', 'rejected']);

export const isPipelineRevisionVisibleToContributor = ({
  contributorId,
  status,
  purgeState,
  viewerId,
  contributor,
  owner,
}: {
  contributorId: string;
  status: PipelineStatus;
  purgeState: 'pending' | null;
  viewerId: string | null;
  contributor: boolean;
  owner: boolean;
}): boolean => {
  if (purgeState) return false;
  if (owner) return true;
  if (!contributor || !viewerId) return false;
  return contributorId === viewerId || !CONTRIBUTOR_HIDDEN_STATUSES.has(status);
};
