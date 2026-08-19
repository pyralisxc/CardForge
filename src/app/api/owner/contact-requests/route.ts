import { getContactRequests } from '@/features/contact/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to read contact requests.');
    }
    return createNoStoreJsonResponse({ requests: await getContactRequests() });
  } catch (error) {
    console.error('Failed to load owner contact requests:', error);
    return createApiErrorResponse(500, 'contact_request_unavailable', 'Unable to load owner inbox.');
  }
}
