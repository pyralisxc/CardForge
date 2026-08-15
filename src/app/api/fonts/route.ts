import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { getCachedCardForgeCatalog } from '@/features/developer-assets/server/catalogCache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse((await getCachedCardForgeCatalog(entitlement.accessMode)).fonts);
  } catch (error) {
    console.error('Failed to load font registry:', error);
    return createApiErrorResponse(500, 'asset_library_unavailable', 'Unable to load reviewed fonts.');
  }
}
