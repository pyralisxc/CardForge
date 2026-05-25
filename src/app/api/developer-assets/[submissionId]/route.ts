import { currentUser } from '@clerk/nextjs/server';

import { resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import {
  DeveloperAssetStoreError,
  updateDeveloperAssetSubmissionDetails,
  updateDeveloperAssetSubmissionStatus,
} from '@/lib/developerAssetStore';
import { getCurrentOwnerAccess } from '@/lib/serverOwnerAccess';

export const dynamic = 'force-dynamic';

const getDeveloperAccess = async () => {
  const [user, ownerAccess] = await Promise.all([
    currentUser(),
    getCurrentOwnerAccess(),
  ]);

  if (!user) {
    return {
      ok: false as const,
      response: createApiErrorResponse(401, 'sign_in_required', 'Sign in before editing developer assets.'),
    };
  }

  const entitlement = resolveAccountEntitlement({
    authConfigured: true,
    isSignedIn: true,
    emailAddresses: user.emailAddresses.map((email) => email.emailAddress),
    privateMetadata: user.privateMetadata,
    ownerAccess,
  });

  if (entitlement.accessMode !== 'dev' && !ownerAccess.isOwner) {
    return {
      ok: false as const,
      response: createApiErrorResponse(403, 'developer_access_required', 'Developer access is required to edit asset submissions.'),
    };
  }

  return { ok: true as const, user, ownerAccess };
};

const getContributorIds = (userId: string, isOwner: boolean) => (
  isOwner ? [userId, 'cardforge-official'] : [userId]
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const access = await getDeveloperAccess();
    if (!access.ok) return access.response;

    const { submissionId } = await params;
    const body = await request.json() as { name?: unknown; description?: unknown; previewUrl?: unknown };
    const program = await updateDeveloperAssetSubmissionDetails({
      submissionId,
      developerId: access.user.id,
      input: body,
      allowOwnerEdit: access.ownerAccess.isOwner,
      currentContributorIds: getContributorIds(access.user.id, access.ownerAccess.isOwner),
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

    console.error('Failed to edit developer asset submission:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to edit developer asset submission.'
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to update developer asset status.');
    }

    const { submissionId } = await params;
    const body = await request.json() as { status?: unknown; ownerNote?: unknown; ownerAccessTierOverride?: unknown };
    const program = await updateDeveloperAssetSubmissionStatus({
      submissionId,
      status: body.status,
      ownerNote: body.ownerNote,
      ownerAccessTierOverride: body.ownerAccessTierOverride,
      currentUserId: owner.userId,
      currentContributorIds: getContributorIds(owner.userId, true),
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
