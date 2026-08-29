import type { DeveloperAssetStatus } from './developerAssets';
import type { DeveloperAssetProgramView, DeveloperAssetSubmission } from './developerAssetProgram';

export type DeveloperPipelineOwnership = 'mine' | 'other';
export type DeveloperPipelineReviewState = 'available' | 'already-voted' | 'self' | 'closed';

export interface DeveloperPipelineLibraryItem {
  id: string;
  submission: DeveloperAssetSubmission;
  revisions: DeveloperAssetSubmission[];
  currentPublishedSubmission: DeveloperAssetSubmission | null;
  ownership: DeveloperPipelineOwnership;
  reviewState: DeveloperPipelineReviewState;
}

const ACTIVE_STATUS_WEIGHT: Record<DeveloperAssetStatus, number> = {
  publish_candidate: 70,
  voting: 60,
  submitted: 50,
  draft: 40,
  published: 30,
  archived: 20,
  rejected: 10,
};

const REVIEWABLE_STATUSES = new Set<DeveloperAssetStatus>([
  'submitted',
  'voting',
  'publish_candidate',
]);

const revisionNumber = (submission: DeveloperAssetSubmission): number => (
  submission.revisionNumber ?? submission.baseRevisionNumber ?? 0
);

const timestamp = (submission: DeveloperAssetSubmission): number => (
  Date.parse(submission.updatedAt ?? submission.publishedAt ?? submission.submittedAt) || 0
);

const compareNewestRevision = (
  left: DeveloperAssetSubmission,
  right: DeveloperAssetSubmission,
): number => (
  revisionNumber(right) - revisionNumber(left)
  || timestamp(right) - timestamp(left)
  || right.id.localeCompare(left.id)
);

const compareStrongestCandidate = (
  left: DeveloperAssetSubmission,
  right: DeveloperAssetSubmission,
): number => (
  ACTIVE_STATUS_WEIGHT[right.status] - ACTIVE_STATUS_WEIGHT[left.status]
  || compareNewestRevision(left, right)
);

export const getDeveloperPipelineLineageId = (
  submission: DeveloperAssetSubmission,
): string => (
  submission.lineageId
  || submission.targetRegistryAssetId
  || submission.registryAssetId
  || `submission:${submission.id}`
);

export const isDeveloperPipelineReviewable = (
  submission: DeveloperAssetSubmission,
): boolean => REVIEWABLE_STATUSES.has(submission.status);

export const getDeveloperAssetImagePreviewUrl = (
  submission: Pick<DeveloperAssetSubmission, 'previewUrl' | 'sourceMimeType'>,
): string | null => {
  const url = submission.previewUrl.trim();
  if (!url || url.startsWith('/api/templates') || url.startsWith('/api/styles')) return null;
  if (url.startsWith('data:image/')) return url;
  if (submission.sourceMimeType?.startsWith('image/')) return url;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/iu.test(url) ? url : null;
};

export const projectDeveloperPipelineLibrary = (
  program: Pick<DeveloperAssetProgramView, 'submissions' | 'votingQueue' | 'currentContributorIds' | 'settings'>,
): DeveloperPipelineLibraryItem[] => {
  const submissionById = new Map<string, DeveloperAssetSubmission>();
  [...program.submissions, ...program.votingQueue].forEach((submission) => {
    submissionById.set(submission.id, submission);
  });

  const lineages = new Map<string, DeveloperAssetSubmission[]>();
  submissionById.forEach((submission) => {
    const lineageId = getDeveloperPipelineLineageId(submission);
    lineages.set(lineageId, [...(lineages.get(lineageId) ?? []), submission]);
  });

  const contributorIds = new Set(program.currentContributorIds);
  return [...lineages.entries()].map(([lineageId, submissions]): DeveloperPipelineLibraryItem => {
    const revisions = submissions.toSorted(compareNewestRevision);
    const currentPublishedSubmission = revisions
      .filter((submission) => submission.status === 'published')
      .toSorted(compareNewestRevision)[0] ?? null;
    const submission = currentPublishedSubmission
      ?? revisions.toSorted(compareStrongestCandidate)[0];
    const ownership: DeveloperPipelineOwnership = contributorIds.has(submission.developerId) ? 'mine' : 'other';
    const reviewState: DeveloperPipelineReviewState = !isDeveloperPipelineReviewable(submission)
      ? 'closed'
      : ownership === 'mine' && !program.settings.allowContributorSelfVoting
        ? 'self'
        : submission.currentUserVote
          ? 'already-voted'
          : 'available';

    return {
      id: lineageId,
      submission,
      revisions,
      currentPublishedSubmission,
      ownership,
      reviewState,
    };
  }).toSorted((left, right) => (
    timestamp(right.submission) - timestamp(left.submission)
    || left.submission.name.localeCompare(right.submission.name)
  ));
};
