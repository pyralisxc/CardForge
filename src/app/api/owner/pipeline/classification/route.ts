import { AccountToolAccessError } from '@/features/account/server';
import { getCurrentOwnerAccess, getOwnerPublishedClassification, saveOwnerPublishedClassification } from '@/features/owner/server';
import { PipelineRegistryCommandError } from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

const failure = (error: unknown) => {
  if (error instanceof AccountToolAccessError) return createApiErrorResponse(error.status, error.status === 401 ? 'sign_in_required' : 'owner_access_required', error.message);
  const status = error instanceof PipelineRegistryCommandError ? error.status : 503;
  const code = status === 400 ? 'pipeline_classification_invalid' : status === 404 ? 'pipeline_classification_not_found' : status === 409 ? 'pipeline_classification_conflict' : 'pipeline_classification_unavailable';
  return createApiErrorResponse(status, code, error instanceof PipelineRegistryCommandError ? error.message : 'Classification is unavailable. Read exact current state before any further write.', { retryable: false, nextAction: 'Read the exact published classification before any further write; do not replay automatically.' });
};
export async function GET(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to classify published content.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to classify published content.');
    return createNoStoreJsonResponse(await getOwnerPublishedClassification(owner.userId, { assetId: new URL(request.url).searchParams.get('assetId') ?? '' }));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to classify published content.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to classify published content.');
    let input: unknown;
    try { input = await request.json(); } catch { return createApiErrorResponse(400, 'invalid_json', 'Provide a valid classification request.'); }
    const result = await saveOwnerPublishedClassification(owner.userId, input);
    if (result.receipt.outcome === 'uncertain') {
      const unavailable = createApiErrorResponse(503, 'pipeline_classification_unavailable', 'Classification outcome is unconfirmed.', { retryable: false, nextAction: 'Read exact classification before any further write; do not replay automatically.' });
      return createNoStoreJsonResponse({ ...(await unavailable.json()), ...result }, { status: 503, headers: unavailable.headers });
    }
    return createNoStoreJsonResponse({ success: true, ...result });
  } catch (error) { return failure(error); }
}
