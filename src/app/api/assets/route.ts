import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getAssetRegistryPayload } from '@/features/developer-assets/server';
import { getCurrentCardforgeEntitlement } from '@/features/account/server';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse(await getAssetRegistryPayload(entitlement.accessMode));
  } catch (error) {
    console.error('Failed to load asset library:', error);
    return createApiErrorResponse(
      500,
      'asset_library_unavailable',
      'Unable to load asset library.'
    );
  }
}
