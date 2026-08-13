import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getRegistryFontsPayload } from '@/features/developer-assets/server';
import { getCurrentCardforgeEntitlement } from '@/features/account/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse(await getRegistryFontsPayload(entitlement.accessMode));
  } catch (error) {
    console.error('Failed to load font registry:', error);
    return createApiErrorResponse(500, 'asset_library_unavailable', 'Unable to load reviewed fonts.');
  }
}
