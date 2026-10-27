import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import { createStyleReviewRevision, readStyleReviewBase, readStyleReviewReceipt, PipelineRegistryCommandError } from '@/features/pipeline/server';
import { parseJsonBodyWithLimit, STUDIO_CONTENT_MAX_JSON_BODY_BYTES } from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
const failure = (error: unknown) => error instanceof PipelineRegistryCommandError
  ? createApiErrorResponse(error.status, error.status === 409 ? 'style_review_conflict' : error.status === 404 ? 'style_review_not_found' : error.status === 400 ? 'invalid_style_payload' : 'style_library_unavailable', error.message)
  : createApiErrorResponse(503, 'style_library_unavailable', 'The review outcome is unavailable. Your saved draft and attempt are unchanged. Retry the same attempt.');

export async function GET(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to inspect a Style revision.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    const params = new URL(request.url).searchParams;
    const assetId = params.get('assetId') ?? '';
    return createNoStoreJsonResponse(params.has('submissionKey')
      ? { receipt: await readStyleReviewReceipt(assetId, params.get('submissionKey') ?? '', owner.userId) }
      : await readStyleReviewBase(assetId));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to submit a Style revision.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    const body = await parseJsonBodyWithLimit(request, STUDIO_CONTENT_MAX_JSON_BODY_BYTES);
    if (!body.ok) return createApiErrorResponse(body.code === 'payload_too_large' ? 413 : 400, body.code, body.message);
    const receipt = await createStyleReviewRevision(body.data, owner.userId);
    const activityRecorded = await recordOwnerActivity({ actorUserId: owner.userId, actorEmail: owner.email,
      action: 'library.style.review_revision', targetType: 'contributor_asset_revision', targetId: receipt.id,
      summary: 'Created or recovered a same-lineage Style review revision. Published content is unchanged.' });
    return createNoStoreJsonResponse({ ...receipt, activityRecorded });
  } catch (error) { return failure(error); }
}
