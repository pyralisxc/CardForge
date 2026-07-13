import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { getRegistryFontsPayload } from '@/features/developer-assets/lib/registryFonts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return createNoStoreJsonResponse(await getRegistryFontsPayload());
  } catch (error) {
    console.error('Failed to load font registry:', error);
    return createApiErrorResponse(500, 'asset_library_unavailable', 'Unable to load reviewed fonts.');
  }
}
