import { z } from 'zod';
import { verifySelectedPublishedManagedRaster, PipelineRegistryCommandError } from '@/features/pipeline/server';
import { ContributorAccessError, getCurrentContributorAccess, requireContributionScope } from '@/features/contributor-access/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { getCachedCardForgeCatalog } from '@/features/pipeline/server/catalogCache';

export async function GET(request?: Request) {
  try {
    const query = request ? new URL(request.url).searchParams : null;
    if (query?.has('registryAssetId')) {
      const access = await getCurrentContributorAccess();
      requireContributionScope(access, 'library.submit');
      const selection = z.object({ registryAssetId: z.string().min(1).max(200), publishedSubmissionId: z.string().uuid(), elementId: z.string().min(1).max(200) }).strict().safeParse(Object.fromEntries(query));
      if (!selection.success) return createApiErrorResponse(400, 'invalid_template_payload', 'Choose one exact published raster and image slot.');
      await verifySelectedPublishedManagedRaster(selection.data);
      // A read-only observation, not authority or a persistent receipt. Never return Storage/digest evidence.
      return createNoStoreJsonResponse({ state: 'ready', selection: selection.data });
    }
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse((await getCachedCardForgeCatalog(entitlement.accessMode)).assets);
  } catch (error) {
    if (error instanceof ContributorAccessError) return createApiErrorResponse(error.status, 'contributor_access_required', error.message);
    if (error instanceof PipelineRegistryCommandError) {
      const code = error.code === 'managed_raster_ineligible' || error.code === 'managed_raster_conflict'
        ? error.code : error.status === 409 ? 'managed_raster_conflict' : 'pipeline_unavailable';
      return createApiErrorResponse(error.status, code, error.message);
    }
    console.error('Failed to load asset library:', error);
    return createApiErrorResponse(
      500,
      'asset_library_unavailable',
      'Unable to load asset library.'
    );
  }
}
