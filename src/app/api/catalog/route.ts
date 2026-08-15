import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { getCachedCardForgeCatalog } from '@/features/developer-assets/server/catalogCache';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse(await getCachedCardForgeCatalog(entitlement.accessMode));
  } catch (error) {
    console.error('Failed to load CardForge catalog:', error);
    return createApiErrorResponse(500, 'asset_library_unavailable', 'Unable to load the CardForge catalog.');
  }
}
