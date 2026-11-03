import { ContactRequestStoreError } from '@/features/contact/server';
import { AccountToolAccessError } from '@/features/account/server';
import { getCurrentOwnerAccess, readOwnerInbox } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to read contact requests.');
    const params = new URL(request.url).searchParams;
    const input: Record<string, unknown> = params.has('requestId') ? { requestId: params.get('requestId') } : { status: 'all', pageSize: 50 };
    if (!params.has('requestId')) for (const name of ['query','kind','status','page','pageSize']) if (params.has(name)) input[name] = name === 'page' || name === 'pageSize' ? Number(params.get(name)) : params.get(name);
    const result = await readOwnerInbox(owner.userId, input);
    return createNoStoreJsonResponse({ ...result, requests: result.window?.items ?? [] });
  } catch (error) {
    const status = error instanceof ContactRequestStoreError || error instanceof AccountToolAccessError ? error.status : 503;
    return createApiErrorResponse(status, status === 403 ? 'owner_access_required' : status === 400 ? 'contact_request_invalid' : 'contact_request_unavailable', error instanceof ContactRequestStoreError || error instanceof AccountToolAccessError ? error.message : 'Owner inbox is unavailable; an empty result was not established.');
  }
}
