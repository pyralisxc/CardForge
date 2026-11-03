import { AccountToolAccessError } from '@/features/account/server';
import { getCurrentOwnerAccess, createOwnerReviewRevision, getOwnerReviewRevisionBase, getOwnerReviewRevisionReceipt } from '@/features/owner/server';
import { PipelineRegistryCommandError } from '@/features/pipeline/server';
import { parseJsonBodyWithLimit, STUDIO_CONTENT_MAX_JSON_BODY_BYTES } from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
const failure = (error: unknown) => {
  const status = error instanceof PipelineRegistryCommandError || error instanceof AccountToolAccessError ? error.status : 503;
  return createApiErrorResponse(status, status === 401 ? 'sign_in_required' : status === 403 ? 'owner_access_required' : status === 400 ? 'invalid_template_payload' : 'template_library_unavailable',
    error instanceof PipelineRegistryCommandError || error instanceof AccountToolAccessError ? error.message : 'The review outcome is unavailable. Read the exact saved receipt before any further write; retain your draft and attempt key.', { retryable: false, nextAction: 'Read the exact actor-bound receipt; do not replay automatically or invent a new key.' });
};
export async function GET(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to inspect a review revision.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    const params = new URL(request.url).searchParams, assetId = params.get('assetId') ?? '';
    return createNoStoreJsonResponse(params.has('submissionKey')
      ? await getOwnerReviewRevisionReceipt(owner.userId, 'template', { assetId, submissionKey: params.get('submissionKey') ?? '' })
      : await getOwnerReviewRevisionBase(owner.userId, 'template', { assetId }));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to submit a review revision.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    const body = await parseJsonBodyWithLimit(request, STUDIO_CONTENT_MAX_JSON_BODY_BYTES);
    if (!body.ok) return createApiErrorResponse(body.code === 'payload_too_large' ? 413 : 400, body.code, body.message);
    const result = await createOwnerReviewRevision(owner.userId, 'template', body.data);
    if (result.outcome === 'uncertain') {
      const unavailable = createApiErrorResponse(503, 'template_library_unavailable', result.warnings.join(' '), { retryable: false, nextAction: 'Read the exact actor-bound receipt; do not replay automatically or invent a new key.' });
      return createNoStoreJsonResponse({ ...(await unavailable.json()), ...result }, { status: 503, headers: unavailable.headers });
    }
    // Retain the browser's existing flat native receipt while sharing complete command evidence with MCP.
    return createNoStoreJsonResponse({ ...result.receipt, ...result });
  } catch (error) { return failure(error); }
}
