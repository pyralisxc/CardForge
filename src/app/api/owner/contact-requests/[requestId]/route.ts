import { updateContactRequestStatus } from '@/features/contact/server';
import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  try {
    const [{ requestId }, body] = await Promise.all([
      context.params,
      request.json() as Promise<{ status?: unknown }>,
    ]);
    const status = body.status === 'closed' ? 'closed' : body.status === 'received' ? 'received' : null;
    if (!status) return createApiErrorResponse(400, 'contact_request_invalid', 'Choose open or closed.');
    await updateContactRequestStatus({ id: requestId, status });
    const activityRecorded = await recordOwnerActivity({
      actorUserId: owner.userId,
      actorEmail: owner.email,
      action: 'inbox.status.update',
      targetType: 'contact_request',
      targetId: requestId,
      summary: `Marked a contact request ${status === 'closed' ? 'closed' : 'open'}.`,
      metadata: { status },
    });
    return createNoStoreJsonResponse({ status, activityRecorded });
  } catch (error) {
    console.error('Failed to update owner contact request:', error);
    return createApiErrorResponse(500, 'contact_request_unavailable', error instanceof Error ? error.message : 'Unable to update contact request.');
  }
}
