import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { getAssetRegistryPayload } from '@/lib/assetRegistry';

export async function GET() {
  try {
    return createNoStoreJsonResponse(await getAssetRegistryPayload());
  } catch (error) {
    console.error('Failed to load asset library:', error);
    return createApiErrorResponse(
      500,
      'asset_library_unavailable',
      'Unable to load asset library.'
    );
  }
}
