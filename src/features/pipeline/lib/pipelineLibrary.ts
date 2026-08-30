import type { PipelineStatus } from './pipelineItems';
import type { PipelineProgramView, PipelineSubmission } from './pipelineProgram';

export type PipelineOwnership = 'mine' | 'other';
export type PipelineReviewState = 'available' | 'already-voted' | 'self' | 'closed';

export interface PipelineLibraryItem {
  id: string;
  submission: PipelineSubmission;
  revisions: PipelineSubmission[];
  currentPublishedSubmission: PipelineSubmission | null;
  ownership: PipelineOwnership;
  reviewState: PipelineReviewState;
}

const ACTIVE_STATUS_WEIGHT: Record<PipelineStatus, number> = {
  publish_candidate: 70,
  voting: 60,
  submitted: 50,
  draft: 40,
  published: 30,
  archived: 20,
  rejected: 10,
};

const REVIEWABLE_STATUSES = new Set<PipelineStatus>([
  'submitted',
  'voting',
  'publish_candidate',
]);

const revisionNumber = (submission: PipelineSubmission): number => (
  submission.revisionNumber ?? submission.baseRevisionNumber ?? 0
);

const timestamp = (submission: PipelineSubmission): number => (
  Date.parse(submission.updatedAt ?? submission.publishedAt ?? submission.submittedAt) || 0
);

const compareNewestRevision = (
  left: PipelineSubmission,
  right: PipelineSubmission,
): number => (
  revisionNumber(right) - revisionNumber(left)
  || timestamp(right) - timestamp(left)
  || right.id.localeCompare(left.id)
);

const compareStrongestCandidate = (
  left: PipelineSubmission,
  right: PipelineSubmission,
): number => (
  ACTIVE_STATUS_WEIGHT[right.status] - ACTIVE_STATUS_WEIGHT[left.status]
  || compareNewestRevision(left, right)
);

export const getPipelineLineageId = (
  submission: PipelineSubmission,
): string => (
  submission.lineageId
  || submission.targetRegistryAssetId
  || submission.registryAssetId
  || `submission:${submission.id}`
);

export const isContributorPipelineReviewable = (
  submission: PipelineSubmission,
): boolean => REVIEWABLE_STATUSES.has(submission.status);

export const getPipelineImagePreviewUrl = (
  submission: Pick<PipelineSubmission, 'previewUrl' | 'sourceMimeType'>,
): string | null => {
  const url = submission.previewUrl.trim();
  if (!url || url.startsWith('/api/templates') || url.startsWith('/api/styles')) return null;
  if (url.startsWith('data:image/')) return url;
  if (submission.sourceMimeType?.startsWith('image/')) return url;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/iu.test(url) ? url : null;
};

export const projectPipelineLibrary = (
  program: Pick<PipelineProgramView, 'submissions' | 'votingQueue' | 'currentContributorIds' | 'settings'>,
): PipelineLibraryItem[] => {
  const submissionById = new Map<string, PipelineSubmission>();
  [...program.submissions, ...program.votingQueue].forEach((submission) => {
    submissionById.set(submission.id, submission);
  });

  const lineages = new Map<string, PipelineSubmission[]>();
  submissionById.forEach((submission) => {
    const lineageId = getPipelineLineageId(submission);
    lineages.set(lineageId, [...(lineages.get(lineageId) ?? []), submission]);
  });

  const contributorIds = new Set(program.currentContributorIds);
  return [...lineages.entries()].map(([lineageId, submissions]): PipelineLibraryItem => {
    const revisions = submissions.toSorted(compareNewestRevision);
    const currentPublishedSubmission = revisions
      .filter((submission) => submission.status === 'published')
      .toSorted(compareNewestRevision)[0] ?? null;
    const submission = currentPublishedSubmission
      ?? revisions.toSorted(compareStrongestCandidate)[0];
    const ownership: PipelineOwnership = contributorIds.has(submission.contributorId) ? 'mine' : 'other';
    const reviewState: PipelineReviewState = !isContributorPipelineReviewable(submission)
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
