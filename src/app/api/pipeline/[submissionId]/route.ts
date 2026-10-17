import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { revalidateCardForgeCatalog } from '@/features/pipeline/server/catalogCache';
import {
  PipelineStoreError,
  PipelineRegistryCommandError,
  readSourceReviewEvidence,
  recordSourceReviewEvidence,
  changeOwnedPipelineSubmissionLifecycle,
  finalizeContributorTemplatePipelineDraft,
  getCurrentPipelineRequestAccess,
  permanentlyDeletePipelineSubmission,
  requirePipelineRequestScope,
  updatePipelineEditorialReview,
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

const sourceEvidenceErrorCode = (status: number) => status === 409 ? 'pipeline_source_evidence_conflict'
  : status === 404 ? 'pipeline_source_evidence_not_found' : status >= 500 ? 'pipeline_source_evidence_unavailable' : 'pipeline_source_evidence_invalid';

export async function GET(_request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to inspect correction evidence.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    return createNoStoreJsonResponse(await readSourceReviewEvidence((await params).submissionId));
  } catch (error) {
    return createApiErrorResponse(error instanceof PipelineRegistryCommandError ? error.status : 503, sourceEvidenceErrorCode(error instanceof PipelineRegistryCommandError ? error.status : 503),
      error instanceof PipelineRegistryCommandError ? error.message : 'Source evidence is unavailable. Existing observations are unchanged.');
  }
}

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
      semanticRole?: unknown;
      visualFamily?: unknown;
      variantKind?: unknown;
      variantLabel?: unknown;
      compatibilityTags?: unknown;
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
    const { submissionId } = await params;
    const body = await request.json() as {
      action?: unknown;
      name?: unknown;
      description?: unknown;
      previewUrl?: unknown;
      sourceNotes?: unknown;
      specialtyTags?: unknown;
      useCaseTags?: unknown;
      semanticRole?: unknown;
      visualFamily?: unknown;
      variantKind?: unknown;
      variantLabel?: unknown;
      compatibilityTags?: unknown;
      requestedStudioDestination?: unknown;
    };
    if (body.action === 'withdraw' || body.action === 'retire') {
      requirePipelineRequestScope(access, 'assets.submit');
      const lifecycle = await changeOwnedPipelineSubmissionLifecycle({
        submissionId,
        contributorId: access.user.id,
        action: body.action,
      });
      revalidateCardForgeCatalog();
      return createNoStoreJsonResponse({ lifecycle });
    }
    requirePipelineRequestScope(access, 'library.submit');
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
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to update Pipeline review.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to update Pipeline status.');

    const { submissionId } = await params;
    const parsed = await parseJsonBodyWithLimit(request, 65_536);
    if (!parsed.ok) return createApiErrorResponse(parsed.code === 'payload_too_large' ? 413 : 400, parsed.code, parsed.message);
    if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) return createApiErrorResponse(400, 'pipeline_request_invalid', 'Provide one Pipeline action object.');
    const body = parsed.data as {
      sourceReviewEvidence?: unknown;
      expectedEvidenceVersion?: unknown;
      ownerStatusOverride?: unknown;
      status?: unknown;
      ownerNote?: unknown;
      ownerAccessTierOverride?: unknown;
      editorialReviewStatus?: unknown;
      editorialReviewNote?: unknown;
    };
    if (Object.prototype.hasOwnProperty.call(body, 'sourceReviewEvidence')) {
      if (Object.keys(body).length !== 1) return createApiErrorResponse(400, 'pipeline_request_invalid', 'Record source evidence separately from an editorial or publication decision.');
      const snapshot = await recordSourceReviewEvidence(submissionId, body.sourceReviewEvidence, owner.userId);
      const activityRecorded = await recordOwnerActivity({ actorUserId: owner.userId, actorEmail: owner.email,
        action: 'library.asset.source_evidence', targetType: 'contributor_asset_revision', targetId: submissionId,
        summary: 'Recorded correction-review source observations without changing inherited source claims, artwork or publication.' });
      return createNoStoreJsonResponse({ snapshot, activityRecorded });
    }
    if (Object.prototype.hasOwnProperty.call(body, 'editorialReviewStatus')) {
      const program = await updatePipelineEditorialReview({
        submissionId,
        reviewStatus: body.editorialReviewStatus,
        reviewNote: body.editorialReviewNote,
        expectedEvidenceVersion: body.expectedEvidenceVersion,
        currentUserId: owner.userId,
        currentContributorIds: getContributorIds(owner.userId),
      });
      revalidateCardForgeCatalog();
      await recordOwnerActivity({
        actorUserId: owner.userId,
        actorEmail: owner.email,
        action: 'library.asset.editorial_review',
        targetType: 'contributor_asset_revision',
        targetId: submissionId,
        summary: `Recorded editorial review outcome: ${String(body.editorialReviewStatus)}.`,
      });
      return createNoStoreJsonResponse({ program });
    }

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
      targetType: 'contributor_asset',
      targetId: submissionId,
      summary: 'Updated an owner publication or access-tier override for a shared library asset.',
    });

    return createNoStoreJsonResponse({ program });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof PipelineStoreError || error instanceof PipelineRegistryCommandError) {
      return createApiErrorResponse(
        error.status,
        error instanceof PipelineRegistryCommandError ? sourceEvidenceErrorCode(error.status) : getPipelineErrorCode(error.status),
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
      targetType: 'contributor_asset',
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