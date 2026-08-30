import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { revalidateCardForgeCatalog } from '@/features/pipeline/server/catalogCache';
import {
  PipelineStoreError,
  finalizeContributorTemplatePipelineDraft,
  getCurrentPipelineRequestAccess,
  permanentlyDeletePipelineSubmission,
  requirePipelineRequestScope,
  updatePipelineSubmissionDetails,
  updatePipelineSubmissionStatus,
} from '@/features/pipeline/server';
import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

const getContributorIds = (userId: string) => [userId];

const getPipelineErrorCode = (status: number) => status === 401
  ? 'sign_in_required'
  : status === 403
    ? 'contributor_access_required'
    : status === 503
      ? 'pipeline_unavailable'
      : 'pipeline_request_invalid';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const access = await getCurrentPipelineRequestAccess();
    requirePipelineRequestScope(access, 'assets.submit');

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
    await updatePipelineSubmissionDetails({
      submissionId,
      contributorId: access.user.id,
      input: body,
      allowOwnerEdit: access.isOwner,
    });
    revalidateCardForgeCatalog();
    return createNoStoreJsonResponse({ updated: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        getPipelineErrorCode(error.status),
        error.message
      );
    }

    console.error('Failed to edit Pipeline submission:', error);
    return createApiErrorResponse(
      500,
      'pipeline_request_invalid',
      'Unable to edit Pipeline submission.'
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const access = await getCurrentPipelineRequestAccess();
    requirePipelineRequestScope(access, 'library.submit');
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
    await finalizeContributorTemplatePipelineDraft({
      submissionId,
      contributorId: access.user.id,
      input: body,
    });
    revalidateCardForgeCatalog();
    return createNoStoreJsonResponse({ submitted: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        getPipelineErrorCode(error.status),
        error.message,
      );
    }
    console.error('Failed to submit Template Pipeline draft:', error);
    return createApiErrorResponse(500, 'pipeline_request_invalid', 'Unable to submit the Template Pipeline draft.');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to update Pipeline status.');
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
    const program = await updatePipelineSubmissionStatus({
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
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        getPipelineErrorCode(error.status),
        error.message
      );
    }

    console.error('Failed to update Pipeline status:', error);
    return createApiErrorResponse(
      500,
      'pipeline_request_invalid',
      'Unable to update Pipeline status.'
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
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to permanently delete Pipelines.');
    }

    const { submissionId } = await params;
    const body = await request.json() as { confirmationName?: unknown };
    const program = await permanentlyDeletePipelineSubmission({
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
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        getPipelineErrorCode(error.status),
        error.message
      );
    }

    console.error('Failed to permanently delete Pipeline:', error);
    return createApiErrorResponse(
      500,
      'pipeline_request_invalid',
      'Unable to permanently delete Pipeline.'
    );
  }
}
