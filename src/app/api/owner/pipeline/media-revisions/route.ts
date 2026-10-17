import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import { createMediaPresentationRevision, readMediaPresentationRevision, PipelineRegistryCommandError } from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse, type ApiErrorCode } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
const failure = (error: unknown) => {
  const codes: Record<number, ApiErrorCode> = { 400: 'pipeline_media_invalid', 404: 'pipeline_media_not_found', 409: 'pipeline_media_conflict', 503: 'pipeline_media_unavailable' };
  return error instanceof PipelineRegistryCommandError
    ? createApiErrorResponse(error.status, codes[error.status] ?? 'pipeline_media_unavailable', error.message)
    : createApiErrorResponse(503, 'pipeline_media_unavailable', 'The media revision outcome is unavailable. Retry the same attempt to confirm it.');
};

export async function GET(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to inspect a presentation revision.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    return createNoStoreJsonResponse(await readMediaPresentationRevision(new URL(request.url).searchParams.get('assetId') ?? ''));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.userId) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to create a presentation revision.');
    if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    let input: unknown;
    try { input = await request.json(); } catch { return createApiErrorResponse(400, 'invalid_json', 'Provide a valid presentation revision request.'); }
    const result = await createMediaPresentationRevision(input);
    const activityRecorded = await recordOwnerActivity({
      actorUserId: owner.userId, actorEmail: owner.email,
      action: 'library.asset.presentation_revision', targetType: 'contributor_asset_revision', targetId: result.id,
      summary: 'Created or recovered a pending media presentation revision. Published content is unchanged.',
    });
    return createNoStoreJsonResponse({ ...result, activityRecorded });
  } catch (error) { return failure(error); }
}
