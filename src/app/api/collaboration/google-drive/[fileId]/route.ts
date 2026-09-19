import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import {
  CollaborationSessionError,
  getGoogleDriveCollaborationSession,
  leaveGoogleDriveCollaborationSession,
  startOrJoinGoogleDriveCollaborationSession,
} from '@/features/collaboration/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const getAccountUserId = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new CollaborationSessionError('Sign in before joining live collaboration.', 401, 'collaboration_auth_required');
  }
  return entitlement.accountUserId;
};

const toErrorResponse = (error: unknown) => {
  if (error instanceof CollaborationSessionError) {
    return createApiErrorResponse(error.status, error.code, error.message);
  }
  console.error('Live collaboration request failed:', error);
  return createApiErrorResponse(500, 'collaboration_unavailable', 'Live collaboration is temporarily unavailable.');
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const ownerUserId = await getAccountUserId();
    const { fileId } = await context.params;
    const session = await getGoogleDriveCollaborationSession({ ownerUserId, fileId });
    return Response.json({ session }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const ownerUserId = await getAccountUserId();
    const { fileId } = await context.params;
    const session = await startOrJoinGoogleDriveCollaborationSession({ ownerUserId, fileId });
    return Response.json({ session }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const ownerUserId = await getAccountUserId();
    const { fileId } = await context.params;
    const left = await leaveGoogleDriveCollaborationSession({ ownerUserId, fileId });
    return Response.json({ left }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
