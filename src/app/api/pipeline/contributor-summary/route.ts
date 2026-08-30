import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  getCurrentPipelineRequestAccess,
  getPipelineContributorSummary,
  PipelineStoreError,
  requirePipelineRequestScope,
} from '@/features/pipeline/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await getCurrentPipelineRequestAccess();
    requirePipelineRequestScope(access, 'assets.submit');
    return createNoStoreJsonResponse({
      summary: await getPipelineContributorSummary(access.user.id),
    });
  } catch (error) {
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401
          ? 'sign_in_required'
          : error.status === 403
            ? 'contributor_access_required'
            : 'pipeline_unavailable',
        error.message,
        {
          kind: error.boundary.kind,
          nextAction: error.boundary.nextAction,
          limit: error.boundary.limit,
        },
      );
    }
    console.error('Failed to load Contributor summary:', error);
    return createApiErrorResponse(500, 'pipeline_unavailable', 'Unable to load Contributor progress.');
  }
}
