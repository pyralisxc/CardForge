import type { DeveloperAssetStatus } from './developerAssets';

const CONTRIBUTOR_HIDDEN_STATUSES = new Set<DeveloperAssetStatus>(['draft', 'rejected']);

export const isPipelineRevisionVisibleToContributor = ({
  developerId,
  status,
  purgeState,
  viewerId,
  contributor,
  owner,
}: {
  developerId: string;
  status: DeveloperAssetStatus;
  purgeState: 'pending' | null;
  viewerId: string | null;
  contributor: boolean;
  owner: boolean;
}): boolean => {
  if (purgeState) return false;
  if (owner) return true;
  if (!contributor || !viewerId) return false;
  return developerId === viewerId || !CONTRIBUTOR_HIDDEN_STATUSES.has(status);
};
