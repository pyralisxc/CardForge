import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import {
  CollaborationSessionError,
  getGoogleDriveCollaborationState,
  mergeGoogleDriveCollaborationUpdate,
} from '@/features/collaboration/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';

export const dynamic = 'force-dynamic';

const COLLABORATION_UPDATE_JSON_BYTES = 768 * 1024;

const getAccountUserId = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new CollaborationSessionError('Sign in before using live collaboration.', 401, 'collaboration_auth_required');
  }
  return entitlement.accountUserId;
};

const toErrorResponse = (error: unknown) => {
  if (error instanceof CollaborationSessionError) {
    return createApiErrorResponse(error.status, error.code, error.message);
  }
  console.error('Live collaboration state request failed:', error);
  return createApiErrorResponse(500, 'collaboration_unavailable', 'Live collaboration is temporarily unavailable.');
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const ownerUserId = await getAccountUserId();
    const { fileId } = await context.params;
    const state = await getGoogleDriveCollaborationState({ ownerUserId, fileId });
    return Response.json(state, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const ownerUserId = await getAccountUserId();
    const body = await parseJsonBodyWithLimit(request, COLLABORATION_UPDATE_JSON_BYTES);
    if (!body.ok) return createApiErrorResponse(
      body.code === 'payload_too_large' ? 413 : 400,
      body.code,
      body.message,
    );
    const update = typeof (body.data as { update?: unknown } | null)?.update === 'string'
      ? (body.data as { update: string }).update
      : '';
    if (!update) return createApiErrorResponse(400, 'invalid_json', 'A base64url collaboration update is required.');
    const { fileId } = await context.params;
    const state = await mergeGoogleDriveCollaborationUpdate({ ownerUserId, fileId, update });
    return Response.json(state, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
