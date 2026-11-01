export const isSharedPipelineTrash = (row: {
  trashedAt?: string | null; trashPreviousStatus?: string | null; publicationRetained?: boolean;
  publishedAt?: string | null; trashActorRole?: string | null;
}): boolean => !row.trashedAt || Boolean(row.publicationRetained || row.publishedAt || row.trashActorRole === 'voting'
  || row.trashPreviousStatus && ['submitted', 'voting', 'publish_candidate', 'published'].includes(row.trashPreviousStatus));

import type { PipelineStatus } from './pipelineItems';

const CONTRIBUTOR_HIDDEN_STATUSES = new Set<PipelineStatus>(['draft', 'rejected']);

export const isPipelineRevisionVisibleToContributor = ({
  contributorId,
  status,
  purgeState,
  viewerId,
  contributor,
  owner,
  ...trash
}: {
  contributorId: string;
  status: PipelineStatus;
  purgeState: 'pending' | null;
  viewerId: string | null;
  contributor: boolean;
  owner: boolean;
  trashPreviousStatus?: PipelineStatus | null; trashedAt?: string | null; publicationRetained?: boolean; publishedAt?: string | null; trashActorRole?: string | null;
}): boolean => {
  if (purgeState) return false;
  if (owner) return true;
  if (!contributor || !viewerId) return false;
  if (contributorId === viewerId) return true;
  if (status === 'draft') return false;
  return trash.trashedAt ? isSharedPipelineTrash(trash) : !CONTRIBUTOR_HIDDEN_STATUSES.has(status);
};
