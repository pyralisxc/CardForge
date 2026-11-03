import { ContactRequestStoreError } from '@/features/contact/server';
import { AccountToolAccessError } from '@/features/account/server';
import { getCurrentOwnerAccess, readOwnerInbox, saveOwnerInboxStatus } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
const failure = (error: unknown) => {
  const status = error instanceof ContactRequestStoreError || error instanceof AccountToolAccessError ? error.status : error instanceof SyntaxError ? 400 : 503;
  return createApiErrorResponse(status, status === 403 ? 'owner_access_required' : status === 400 ? 'contact_request_invalid' : 'contact_request_unavailable', error instanceof ContactRequestStoreError || error instanceof AccountToolAccessError ? error.message : 'Inbox outcome is unconfirmed. Read the exact request before any further write.', { retryable: false, nextAction: 'Read the exact request; do not replay automatically.' });
};
export async function GET(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    const owner = await getCurrentOwnerAccess(); if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    return createNoStoreJsonResponse(await readOwnerInbox(owner.userId, await context.params));
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    const owner = await getCurrentOwnerAccess(); if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    const [{ requestId }, body] = await Promise.all([context.params, request.json()]);
    const result = await saveOwnerInboxStatus(owner.userId, { ...body, requestId });
    if (result.receipt.outcome === 'uncertain') {
      const unavailable = createApiErrorResponse(503, 'contact_request_unavailable', result.receipt.warnings.join(' '), { retryable: false, nextAction: 'Read the exact request; do not replay automatically.' });
      return createNoStoreJsonResponse({ ...(await unavailable.json()), ...result }, { status: 503, headers: unavailable.headers });
    }
    return createNoStoreJsonResponse({ ...result, activityRecorded: result.receipt.activityRecorded });
  } catch (error) { return failure(error); }
}
