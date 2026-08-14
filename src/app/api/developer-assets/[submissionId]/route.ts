import { resolveAccountEntitlement } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  DeveloperAssetStoreError,
  permanentlyDeleteDeveloperAssetSubmission,
  projectDeveloperAssetProgramForViewer,
  updateDeveloperAssetSubmissionDetails,
  updateDeveloperAssetSubmissionStatus,
} from '@/features/developer-assets/server';
import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

const getDeveloperAccess = async () => {
  const { authConfigured, user, ownerAccess } = await getCurrentCardforgeUserAccess();

  if (!user) {
    return {
      ok: false as const,
      response: createApiErrorResponse(401, 'sign_in_required', 'Sign in before editing developer assets.'),
    };
  }

  const entitlement = resolveAccountEntitlement({
    authConfigured,
    isSignedIn: true,
    emailAddresses: user.emailAddresses,
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

const getContributorIds = (userId: string) => [userId];

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
      currentContributorIds: getContributorIds(access.user.id),
    });

    return createNoStoreJsonResponse({
      program: projectDeveloperAssetProgramForViewer(program, {
        currentUserId: access.user.id,
        isOwner: access.ownerAccess.isOwner,
      }),
    });
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
    const body = await request.json() as {
      ownerStatusOverride?: unknown;
      status?: unknown;
      ownerNote?: unknown;
      ownerAccessTierOverride?: unknown;
    };
    const ownerStatusOverride = Object.prototype.hasOwnProperty.call(body, 'ownerStatusOverride')
      ? body.ownerStatusOverride
      : body.status;
    const program = await updateDeveloperAssetSubmissionStatus({
      submissionId,
      ownerStatusOverride,
      ownerNote: body.ownerNote,
      ownerAccessTierOverride: body.ownerAccessTierOverride,
      currentUserId: owner.userId,
      currentContributorIds: getContributorIds(owner.userId),
    });
    await recordOwnerActivity({
      actorUserId: owner.userId,
      actorEmail: owner.email,
      action: 'library.asset.override',
      targetType: 'developer_asset',
      targetId: submissionId,
      summary: 'Updated an owner publication or access-tier override for a shared library asset.',
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to permanently delete developer assets.');
    }

    const { submissionId } = await params;
    const body = await request.json() as { confirmationName?: unknown };
    const program = await permanentlyDeleteDeveloperAssetSubmission({
      submissionId,
      confirmationName: body.confirmationName,
      currentUserId: owner.userId,
      currentContributorIds: getContributorIds(owner.userId),
    });
    await recordOwnerActivity({
      actorUserId: owner.userId,
      actorEmail: owner.email,
      action: 'library.asset.delete',
      targetType: 'developer_asset',
      targetId: submissionId,
      summary: `Permanently deleted the shared asset lineage for ${typeof body.confirmationName === 'string' ? body.confirmationName : submissionId}.`,
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

    console.error('Failed to permanently delete developer asset:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to permanently delete developer asset.'
    );
  }
}
