import { AccountToolAccessError } from '@/features/account/server';
import { getCurrentOwnerAccess, getOwnerMediaRevisionBase, getOwnerMediaRevisionReceipt, createOwnerMediaRevision } from '@/features/owner/server';
import { PipelineRegistryCommandError } from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse, type ApiErrorCode } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
const failure = (error: unknown) => {
  const status = error instanceof PipelineRegistryCommandError || error instanceof AccountToolAccessError ? error.status : 503;
  const codes: Record<number, ApiErrorCode> = { 400: 'pipeline_media_invalid', 401: 'sign_in_required', 403: 'owner_access_required', 404: 'pipeline_media_not_found', 409: 'pipeline_media_conflict', 503: 'pipeline_media_unavailable' };
  return createApiErrorResponse(status, codes[status] ?? 'pipeline_media_unavailable', error instanceof PipelineRegistryCommandError || error instanceof AccountToolAccessError ? error.message : 'The media revision outcome is unconfirmed. Read the exact retained receipt before any further write.', { retryable: false, nextAction: 'Read the exact asset, UUID key and saved presentation receipt; do not copy or replay automatically.' });
};
export async function GET(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to inspect a presentation revision.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    const params = new URL(request.url).searchParams, assetId = params.get('assetId') ?? '';
    if (!params.has('submissionKey')) return createNoStoreJsonResponse(await getOwnerMediaRevisionBase(owner.userId, { assetId }));
    let presentation: unknown;
    try { presentation = JSON.parse(params.get('presentation') ?? ''); } catch { return createApiErrorResponse(400, 'pipeline_media_invalid', 'Provide the complete retained presentation for exact receipt lookup.'); }
    return createNoStoreJsonResponse(await getOwnerMediaRevisionReceipt(owner.userId, { assetId, submissionKey: params.get('submissionKey') ?? '', presentation }));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to create a presentation revision.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    let input: unknown;
    try { input = await request.json(); } catch { return createApiErrorResponse(400, 'invalid_json', 'Provide a valid presentation revision request.'); }
    const result = await createOwnerMediaRevision(owner.userId, input);
    if (result.outcome === 'uncertain') {
      const unavailable = createApiErrorResponse(503, 'pipeline_media_unavailable', result.warnings.join(' '), { retryable: false, nextAction: 'Read the exact retained receipt; do not copy or replay automatically.' });
      return createNoStoreJsonResponse({ ...(await unavailable.json()), ...result }, { status: 503, headers: unavailable.headers });
    }
    return createNoStoreJsonResponse({ ...result.receipt, ...result });
  } catch (error) { return failure(error); }
}
