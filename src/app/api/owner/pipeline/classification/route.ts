import { getCurrentOwnerAccess } from '@/features/owner/server';
import { classifyPublishedPipelineAsset, readPublishedPipelineClassification, PipelineRegistryCommandError, revalidateCardForgeCatalog } from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export async function GET(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to classify published content.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to classify published content.');
    return createNoStoreJsonResponse(await readPublishedPipelineClassification(new URL(request.url).searchParams.get('assetId') ?? ''));
  } catch (error) {
    const status = error instanceof PipelineRegistryCommandError ? error.status : 503;
    const code = status === 400 ? 'pipeline_classification_invalid' : status === 404 ? 'pipeline_classification_not_found' : status === 409 ? 'pipeline_classification_conflict' : 'pipeline_classification_unavailable';
    return createApiErrorResponse(status, code, error instanceof PipelineRegistryCommandError ? error.message : 'Classification is unavailable. Try again.');
  }
}

export async function POST(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to classify published content.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to classify published content.');
    let input: unknown;
    try { input = await request.json(); } catch { return createApiErrorResponse(400, 'invalid_json', 'Provide a valid classification request.'); }
    await classifyPublishedPipelineAsset(input);
    revalidateCardForgeCatalog();
    return createNoStoreJsonResponse({ success: true });
  } catch (error) {
    if (error instanceof PipelineRegistryCommandError) {
      const code = error.status === 400 ? 'pipeline_classification_invalid'
        : error.status === 404 ? 'pipeline_classification_not_found'
          : error.status === 409 ? 'pipeline_classification_conflict' : 'pipeline_classification_unavailable';
      return createApiErrorResponse(error.status, code, error.message);
    }
    return createApiErrorResponse(503, 'pipeline_classification_unavailable', 'Classification is unavailable. Retry the same request to confirm its outcome.');
  }
}
