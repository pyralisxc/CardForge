import {
  PipelineStoreError,
  getCurrentPipelineRequestAccess,
  getPipelineLibraryProgramView,
  getPipelineContributorIds,
  projectPipelineProgramForViewer,
  requirePipelineRequestScope,
} from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { createServerTimingTracker } from '@/infrastructure/http/serverTiming';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timing = createServerTimingTracker();
  try {
    const access = await timing.track('contributor_access', getCurrentPipelineRequestAccess);
    requirePipelineRequestScope(access, 'assets.review');
    const program = await timing.track('library_program', () => getPipelineLibraryProgramView(
      access.user.id,
      getPipelineContributorIds(access.user.id),
      { includeRegistryRecipePayloads: access.isOwner },
    ));
    const response = createNoStoreJsonResponse({
      ownerAccess: access.ownerAccess,
      isContributor: access.isContributor,
      isOwner: access.isOwner,
      program: projectPipelineProgramForViewer(program, {
        currentUserId: access.user.id,
        isOwner: access.isOwner,
      }),
    });
    response.headers.set('Server-Timing', timing.header());
    return response;
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
      );
    }
    console.error('Failed to load the Pipeline Library:', error);
    return createApiErrorResponse(
      500,
      'pipeline_unavailable',
      'Unable to load the Pipeline Library.',
    );
  }
}
