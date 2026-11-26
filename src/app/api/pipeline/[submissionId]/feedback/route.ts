import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCurrentPipelineRequestAccess, getContributorReviewFeedback, PipelineStoreError } from '@/features/pipeline/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const access = await getCurrentPipelineRequestAccess();
    return createNoStoreJsonResponse(await getContributorReviewFeedback(access.user.id, await params));
  } catch (error) {
    const status = error instanceof PipelineStoreError ? error.status : 503;
    return createApiErrorResponse(status, status === 401 ? 'sign_in_required' : status === 403 ? 'contributor_access_required'
      : status === 404 ? 'pipeline_revision_not_found' : 'pipeline_unavailable',
    error instanceof PipelineStoreError ? error.message : 'Exact review feedback is unavailable.');
  }
}
