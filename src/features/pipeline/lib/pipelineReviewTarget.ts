import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import type { PublishedPipelineCatalogItem } from './catalogManifest';
import type { PipelineSubmission } from './pipelineProgram';

/** Ephemeral selection pins, never a replacement for server authorization. */
export interface PipelineReviewTarget {
  catalogPublication?: { submissionId: string; updatedAt: string | null };
  assetId: string | null;
  lineageId: string;
  submissionId: string;
  revisionNumber: number | null;
  status: PipelineSubmission['status'];
  publishedAt: string | null;
  updatedAt: string | null;
}
export const createPipelineReviewTarget = (submission: PipelineSubmission): PipelineReviewTarget | null => {
  const assetId = submission.targetRegistryAssetId ?? submission.registryAssetId;
  return submission.lineageId && (assetId || (!submission.publishedAt && submission.status !== 'published')) ? { assetId, lineageId: submission.lineageId, submissionId: submission.id,
    revisionNumber: submission.revisionNumber, status: submission.status, publishedAt: submission.publishedAt, updatedAt: submission.updatedAt } : null;
};
export const resolvePipelineReviewTarget = (target: PipelineReviewTarget, submissions: readonly PipelineSubmission[]): PipelineSubmission => {
  const submission = submissions.find(candidate => candidate.id === target.submissionId);
  if (!submission) throw new Error('The selected revision is unavailable. Close this tool and refresh Library; no other revision was substituted.');
  const current = createPipelineReviewTarget(submission);
  if (!current || Object.keys(target).filter(key => key !== 'catalogPublication').some(key => current[key as keyof PipelineReviewTarget] !== target[key as keyof PipelineReviewTarget])) {
    throw new Error('The selected revision changed. Close this tool and refresh Library before reviewing it; no other revision was substituted.');
  }
  return submission;
};

/** Published selection also pins the registry's own publication link and epoch. */
export const verifyReviewPublication = (target: PipelineReviewTarget, items: readonly PublishedPipelineCatalogItem[]) => {
  if (!target.catalogPublication) return;
  const current = items.find(item => item.id === target.assetId);
  if (!current || current.lineageId !== target.lineageId || current.submissionId !== target.catalogPublication.submissionId
    || current.updatedAt !== target.catalogPublication.updatedAt) {
    throw new Error('The selected catalog publication changed or is unavailable. Refresh Library; no newer publication was substituted.');
  }
};
export const readReviewPublication = async (target: PipelineReviewTarget, signal?: AbortSignal) => {
  if (!target.catalogPublication) return;
  const response = await fetch('/api/catalog', { cache: 'no-store', signal });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'The selected catalog publication is unavailable.'));
  const catalog = await response.json() as { pipeline?: { items: PublishedPipelineCatalogItem[] } };
  verifyReviewPublication(target, catalog.pipeline?.items ?? []);
};
