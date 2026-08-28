import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { revalidateCardForgeCatalog } from '@/features/developer-assets/server/catalogCache';
import {
  DeveloperAssetStoreError,
  finalizeDeveloperTemplatePipelineDraft,
  getCurrentDeveloperAssetRequestAccess,
  permanentlyDeleteDeveloperAssetSubmission,
  projectDeveloperAssetProgramForViewer,
  requireDeveloperAssetRequestScope,
  updateDeveloperAssetSubmissionDetails,
  updateDeveloperAssetSubmissionStatus,
} from '@/features/developer-assets/server';
import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

const getContributorIds = (userId: string) => [userId];

const getDeveloperAssetErrorCode = (status: number) => status === 401
  ? 'sign_in_required'
  : status === 403
    ? 'developer_access_required'
    : status === 503
      ? 'developer_asset_unavailable'
      : 'developer_asset_request_invalid';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const access = await getCurrentDeveloperAssetRequestAccess();
    requireDeveloperAssetRequestScope(access, 'assets.submit');

    const { submissionId } = await params;
    const body = await request.json() as {
      name?: unknown;
      description?: unknown;
      previewUrl?: unknown;
      sourceNotes?: unknown;
      specialtyTags?: unknown;
      useCaseTags?: unknown;
      requestedStudioDestination?: unknown;
    };
    const program = await updateDeveloperAssetSubmissionDetails({
      submissionId,
      developerId: access.user.id,
      input: body,
      allowOwnerEdit: access.isOwner,
      currentContributorIds: getContributorIds(access.user.id),
    });
    revalidateCardForgeCatalog();

    return createNoStoreJsonResponse({
      program: projectDeveloperAssetProgramForViewer(program, {
        currentUserId: access.user.id,
        isOwner: access.isOwner,
      }),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        getDeveloperAssetErrorCode(error.status),
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const access = await getCurrentDeveloperAssetRequestAccess();
    requireDeveloperAssetRequestScope(access, 'library.submit');
    const { submissionId } = await params;
    const body = await request.json() as {
      name?: unknown;
      description?: unknown;
      previewUrl?: unknown;
      sourceNotes?: unknown;
      specialtyTags?: unknown;
      useCaseTags?: unknown;
      requestedStudioDestination?: unknown;
    };
    const program = await finalizeDeveloperTemplatePipelineDraft({
      submissionId,
      developerId: access.user.id,
      input: body,
      currentContributorIds: getContributorIds(access.user.id),
      includeRegistryRecipePayloads: access.isOwner,
    });
    revalidateCardForgeCatalog();
    return createNoStoreJsonResponse({
      program: projectDeveloperAssetProgramForViewer(program, {
        currentUserId: access.user.id,
        isOwner: access.isOwner,
      }),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        getDeveloperAssetErrorCode(error.status),
        error.message,
      );
    }
    console.error('Failed to submit Template Pipeline draft:', error);
    return createApiErrorResponse(500, 'developer_asset_request_invalid', 'Unable to submit the Template Pipeline draft.');
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
    revalidateCardForgeCatalog();
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
        getDeveloperAssetErrorCode(error.status),
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
    revalidateCardForgeCatalog();
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
        getDeveloperAssetErrorCode(error.status),
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
