import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { getCachedCardForgeStudioAssets } from '@/features/pipeline/server/catalogCache';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse(await getCachedCardForgeStudioAssets(entitlement.accessMode));
  } catch (error) {
    console.error('Failed to load CardForge Studio assets:', error);
    return createApiErrorResponse(500, 'asset_library_unavailable', 'Unable to load the CardForge Studio assets.');
  }
}
