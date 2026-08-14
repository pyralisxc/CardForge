import { getCurrentOwnerAccess, getOwnerActivity } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  try {
    return createNoStoreJsonResponse({ activity: await getOwnerActivity({ page, pageSize: 20 }) });
  } catch (error) {
    console.error('Failed to load owner activity:', error);
    return createApiErrorResponse(500, 'owner_activity_unavailable', 'Unable to load owner change history.');
  }
}
