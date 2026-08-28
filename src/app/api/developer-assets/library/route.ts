import {
  DeveloperAssetStoreError,
  getCurrentDeveloperAssetRequestAccess,
  getDeveloperAssetLibraryProgramView,
  getDeveloperContributorIds,
  projectDeveloperAssetProgramForViewer,
  syncDeveloperAssetRequestProfile,
} from '@/features/developer-assets/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { createServerTimingTracker } from '@/infrastructure/http/serverTiming';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timing = createServerTimingTracker();
  try {
    const access = await timing.track('developer_access', getCurrentDeveloperAssetRequestAccess);
    await timing.track('profile_sync', () => syncDeveloperAssetRequestProfile(access));
    const program = await timing.track('library_program', () => getDeveloperAssetLibraryProgramView(
      access.user.id,
      getDeveloperContributorIds(access.user.id),
      { includeRegistryRecipePayloads: access.isOwner },
    ));
    const response = createNoStoreJsonResponse({
      ownerAccess: access.ownerAccess,
      isDeveloper: access.isDeveloper,
      isOwner: access.isOwner,
      program: projectDeveloperAssetProgramForViewer(program, {
        currentUserId: access.user.id,
        isOwner: access.isOwner,
      }),
    });
    response.headers.set('Server-Timing', timing.header());
    return response;
  } catch (error) {
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401
          ? 'sign_in_required'
          : error.status === 403
            ? 'developer_access_required'
            : 'developer_asset_unavailable',
        error.message,
      );
    }
    console.error('Failed to load the Pipeline Library:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_unavailable',
      'Unable to load the Pipeline Library.',
    );
  }
}
