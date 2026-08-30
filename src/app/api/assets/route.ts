import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { getCachedCardForgeCatalog } from '@/features/pipeline/server/catalogCache';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse((await getCachedCardForgeCatalog(entitlement.accessMode)).assets);
  } catch (error) {
    console.error('Failed to load asset library:', error);
    return createApiErrorResponse(
      500,
      'asset_library_unavailable',
      'Unable to load asset library.'
    );
  }
}
