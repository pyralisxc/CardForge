import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import {
  PipelineStoreError,
  getCurrentPipelineRequestAccess,
  getPipelineLibraryProgramView,
  getSharedPipelineTrashPage,
  getPipelineContributorIds,
  projectPipelineProgramForViewer,
  requirePipelineRequestScope,
} from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { createServerTimingTracker } from '@/infrastructure/http/serverTiming';

export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
  const timing = createServerTimingTracker();
  try {
    const url = request ? new URL(request.url) : null;
    if (url?.searchParams.get('scope') === 'shared') {
      if (url.searchParams.get('trash') !== 'trashed') return createApiErrorResponse(400, 'pipeline_request_invalid', 'Shared Trash discovery requires trash=trashed.');
      const viewer = await getCurrentCardforgeUserAccess();
      if (!viewer.user) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to browse shared Pipeline Trash.');
      const number = (name: string, fallback: number) => {
        const value = Number(url.searchParams.get(name));
        return Number.isInteger(value) && value > 0 ? value : fallback;
      };
      const sharedTrash = await getSharedPipelineTrashPage(viewer.user.id, {
        query: url.searchParams.get('query') ?? '', assetType: url.searchParams.get('assetType') ?? 'all',
        page: number('page', 1), pageSize: number('pageSize', 12),
      });
      return createNoStoreJsonResponse({ sharedTrash });
    }
    const access = await timing.track('contributor_access', getCurrentPipelineRequestAccess);
    requirePipelineRequestScope(access, 'assets.review');
    const program = await timing.track('library_program', () => getPipelineLibraryProgramView(
      access.user.id,
      getPipelineContributorIds(access.user.id),
      { includeRegistryRecipePayloads: access.isOwner, trash: request ? new URL(request.url).searchParams.get('trash') ?? 'active' : 'active' },
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
