import { AccountToolAccessError } from '@/features/account/server';
import { PipelineStoreError } from '@/features/pipeline/server';
import { readPipelineReviewNotices } from '@/features/pipeline/server/pipelineReviewNotices';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
export async function GET() {
  try { return createNoStoreJsonResponse(await readPipelineReviewNotices()); }
  catch (error) {
    const status = error instanceof PipelineStoreError || error instanceof AccountToolAccessError ? error.status : 503;
    return createApiErrorResponse(status, status === 401 ? 'sign_in_required' : status === 403 ? 'contributor_access_required' : 'pipeline_unavailable',
      error instanceof PipelineStoreError || error instanceof AccountToolAccessError ? error.message : 'Pipeline review notices are unavailable.');
  }
}
