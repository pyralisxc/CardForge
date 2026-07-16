import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getAssetRegistryPayload } from '@/features/developer-assets/server';

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
