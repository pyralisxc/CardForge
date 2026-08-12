import { getOwnerAnalyticsSnapshot } from '@/features/analytics/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for analytics.');
  }
  try {
    return createNoStoreJsonResponse(await getOwnerAnalyticsSnapshot());
  } catch (error) {
    console.error('Unable to load owner analytics:', error instanceof Error ? error.message : error);
    return createApiErrorResponse(502, 'analytics_unavailable', 'Analytics reporting is temporarily unavailable.');
  }
}
