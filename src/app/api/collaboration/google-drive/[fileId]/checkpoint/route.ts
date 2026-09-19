import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import {
  checkpointGoogleDriveCollaborationSession,
  CollaborationSessionError,
} from '@/features/collaboration/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const getAccountUserId = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new CollaborationSessionError('Sign in before checkpointing live collaboration.', 401, 'collaboration_auth_required');
  }
  return entitlement.accountUserId;
};

const toErrorResponse = (error: unknown) => {
  if (error instanceof CollaborationSessionError) {
    return createApiErrorResponse(error.status, error.code, error.message);
  }
  console.error('Live collaboration checkpoint failed:', error);
  return createApiErrorResponse(500, 'collaboration_unavailable', 'The collaborative Drive checkpoint is temporarily unavailable.');
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const ownerUserId = await getAccountUserId();
    const { fileId } = await context.params;
    const result = await checkpointGoogleDriveCollaborationSession({ ownerUserId, fileId });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
