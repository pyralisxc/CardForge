import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { revalidateCardForgeCatalog } from '@/features/pipeline/server/catalogCache';
import {
  PipelineStoreError,
  PipelineRegistryCommandError,
  readSourceReviewEvidence,
  changeOwnedPipelineSubmissionLifecycle,
  finalizeContributorTemplatePipelineDraft,
  getCurrentPipelineRequestAccess,
  permanentlyDeletePipelineSubmission,
  requirePipelineRequestScope,
  updatePipelineSubmissionDetails,
} from '@/features/pipeline/server';
import { getCurrentOwnerAccess, recordOwnerActivity, recordOwnerPipelineSourceReviewEvidence, saveOwnerPipelineEditorialReview, saveOwnerPipelinePublicationOverride } from '@/features/owner/server';

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
    const respondDecision = async (result: { snapshot: unknown; program: unknown; receipt: Awaited<ReturnType<typeof saveOwnerPipelineEditorialReview>>['receipt'] }) => {
      if (result.receipt.outcome === 'uncertain') {
        const failure = createApiErrorResponse(503, 'pipeline_unavailable', result.receipt.message, { retryable: false, nextAction: 'Read the exact revision/evidence before any further write; do not replay automatically.' });
        return createNoStoreJsonResponse({ ...(await failure.json()), receipt: result.receipt }, { status: 503, headers: failure.headers });
      }
      return createNoStoreJsonResponse({ snapshot: result.snapshot, program: result.program, receipt: result.receipt, activityRecorded: result.receipt.activityRecorded });
    };
    if (Object.prototype.hasOwnProperty.call(body, 'sourceReviewEvidence')) {
      if (Object.keys(body).length !== 1) return createApiErrorResponse(400, 'pipeline_request_invalid', 'Record source evidence separately from an editorial or publication decision.');
      const evidence = body.sourceReviewEvidence;
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.prototype.hasOwnProperty.call(evidence, 'submissionId')) return createApiErrorResponse(400, 'pipeline_request_invalid', 'Provide the exact evidence request without another target.');
      return respondDecision(await recordOwnerPipelineSourceReviewEvidence(owner.userId, { ...evidence, submissionId }));
    }
    if (Object.prototype.hasOwnProperty.call(body, 'editorialReviewStatus')) {
      if (Object.keys(body).some(key => !['editorialReviewStatus', 'editorialReviewNote', 'expectedEvidenceVersion'].includes(key))) return createApiErrorResponse(400, 'pipeline_request_invalid', 'Record one editorial decision separately from publication controls.');
      return respondDecision(await saveOwnerPipelineEditorialReview(owner.userId, { submissionId, reviewStatus: body.editorialReviewStatus, reviewNote: body.editorialReviewNote, expectedEvidenceVersion: body.expectedEvidenceVersion ?? null }, { includeProgram: true }));
    }
    if (Object.keys(body).some(key => !['ownerStatusOverride', 'status', 'ownerNote', 'ownerAccessTierOverride'].includes(key))) return createApiErrorResponse(400, 'pipeline_request_invalid', 'Provide supported publication controls only; no general CAS or operation ID is available.');
    const ownerStatusOverride = Object.prototype.hasOwnProperty.call(body, 'ownerStatusOverride') ? body.ownerStatusOverride : body.status;
    return respondDecision(await saveOwnerPipelinePublicationOverride(owner.userId, { submissionId,
      ...(ownerStatusOverride !== undefined ? { ownerStatusOverride } : {}),
      ...(body.ownerAccessTierOverride !== undefined ? { ownerAccessTierOverride: body.ownerAccessTierOverride } : {}), ownerNote: body.ownerNote ?? '' }, { includeProgram: true }));
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