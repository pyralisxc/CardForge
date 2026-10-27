import type { PipelineSubmission } from '@/features/pipeline/client';
import { createPipelineReviewTarget } from '@/features/pipeline/client';
import type { LibraryViewItem } from '../components/LibraryObjectPresentation';

export function libraryReviewSelection(item: LibraryViewItem, submissions: readonly PipelineSubmission[]) {
  if (item.scope === 'personal') return null;
  if (item.scope === 'pipeline') return createPipelineReviewTarget(item.pipeline.submission);
  const identity = item.published.publicationIdentity;
  if (!identity) return null;
  const exact = submissions.find(row => row.id === identity.submissionId && row.lineageId === item.published.lineageId
    && row.registryAssetId === identity.assetId && row.status === 'published'
    && (item.published.revision === null || row.revisionNumber === item.published.revision));
  return exact ? createPipelineReviewTarget(exact) : null;
}
export function canEditSelectedContribution(item: LibraryViewItem) {
  return item.scope === 'pipeline' && item.pipeline.ownership === 'mine'
    && item.pipeline.editableSubmission?.id === item.pipeline.submission.id;
}
