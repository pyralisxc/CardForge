import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import {
  DeveloperAssetStoreError,
  updateDeveloperAssetSubmissionStatus,
} from '@/lib/developerAssetStore';
import { getCurrentOwnerAccess } from '@/lib/serverOwnerAccess';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to update developer asset status.');
    }

    const { submissionId } = await params;
    const body = await request.json() as { status?: unknown; ownerNote?: unknown; ownerAccessTierOverride?: unknown };
    const program = await updateDeveloperAssetSubmissionStatus({
      submissionId,
      status: body.status,
      ownerNote: body.ownerNote,
      ownerAccessTierOverride: body.ownerAccessTierOverride,
    });

    return createNoStoreJsonResponse({ program });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'developer_asset_unavailable' : 'developer_asset_request_invalid',
        error.message
      );
    }

    console.error('Failed to update developer asset status:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to update developer asset status.'
    );
  }
}
