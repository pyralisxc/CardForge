import type { PipelineSubmission } from './pipelineProgram';

/** Ephemeral selection pins, never a replacement for server authorization. */
export interface PipelineReviewTarget {
  assetId: string;
  lineageId: string;
  submissionId: string;
  revisionNumber: number | null;
  status: PipelineSubmission['status'];
  publishedAt: string | null;
  updatedAt: string | null;
}
export const createPipelineReviewTarget = (submission: PipelineSubmission): PipelineReviewTarget | null => {
  const assetId = submission.targetRegistryAssetId ?? submission.registryAssetId;
  return assetId && submission.lineageId ? { assetId, lineageId: submission.lineageId, submissionId: submission.id,
    revisionNumber: submission.revisionNumber, status: submission.status, publishedAt: submission.publishedAt, updatedAt: submission.updatedAt } : null;
};
export const resolvePipelineReviewTarget = (target: PipelineReviewTarget, submissions: readonly PipelineSubmission[]): PipelineSubmission => {
  const submission = submissions.find(candidate => candidate.id === target.submissionId);
  if (!submission) throw new Error('The selected revision is unavailable. Close this tool and refresh Library; no other revision was substituted.');
  const current = createPipelineReviewTarget(submission);
  if (!current || Object.keys(target).some(key => current[key as keyof PipelineReviewTarget] !== target[key as keyof PipelineReviewTarget])) {
    throw new Error('The selected revision changed. Close this tool and refresh Library before reviewing it; no other revision was substituted.');
  }
  return submission;
};
