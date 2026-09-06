import {
  PipelineStoreError,
  getCurrentPipelineRequestAccess,
  getOwnPublishedPipelineSubmissions,
  requirePipelineRequestScope,
} from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await getCurrentPipelineRequestAccess();
    // Reading a contributor's own published lineages must not require the
    // broader Forge Review scope.
    requirePipelineRequestScope(access, 'assets.submit');
    return createNoStoreJsonResponse({
      submissions: await getOwnPublishedPipelineSubmissions(access.user.id),
    });
  } catch (error) {
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'contributor_access_required',
        error.message,
      );
    }
    console.error('Failed to load contributor published work:', error);
    return createApiErrorResponse(500, 'pipeline_unavailable', 'Unable to load your published Pipeline work.');
  }
}
