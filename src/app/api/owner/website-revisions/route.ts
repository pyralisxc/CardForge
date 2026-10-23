import { getCurrentOwnerAccess } from '@/features/owner/server';
import { saveWebsiteRevision, readLiveWebsiteRevision, WebsiteEditionStoreError } from '@/features/public-site/server/websiteEditionStore';
import { resolveOwnerWebsiteRevision } from '@/features/public-site/server/websitePresentationResolver';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
const authorized = async () => {
  const owner = await getCurrentOwnerAccess();
  return owner.isOwner && owner.userId ? owner.userId : null;
};
const failure = (error: unknown) => error instanceof WebsiteEditionStoreError
  ? createApiErrorResponse(error.status, error.status === 409 ? 'website_revision_conflict' : error.status === 403 ? 'owner_access_required' : 'website_revision_unavailable', error.message)
  : createApiErrorResponse(503, 'website_revision_unavailable', 'Website revisions are unavailable.');

export async function GET(request: Request) {
  if (!await authorized()) return createApiErrorResponse(403, 'owner_access_required', 'Owner access required.');
  try {
    const id = new URL(request.url).searchParams.get('revisionId');
    if (id) return createNoStoreJsonResponse(await resolveOwnerWebsiteRevision(id));
    return createNoStoreJsonResponse(await readLiveWebsiteRevision());
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const actor = await authorized();
  if (!actor) return createApiErrorResponse(403, 'owner_access_required', 'Owner access required.');
  try {
    const parsed = await parseJsonBodyWithLimit(request);
    if (!parsed.ok) return createApiErrorResponse(parsed.code === 'payload_too_large' ? 413 : 400, parsed.code, parsed.message);
    const body = parsed.data as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || typeof body.editionId !== 'string' || typeof body.operationId !== 'string'
      || !(body.expectedRevisionId === null || typeof body.expectedRevisionId === 'string')) {
      return createApiErrorResponse(400, 'website_revision_invalid', 'Invalid website revision command.');
    }
    const revisionId = await saveWebsiteRevision({
      editionId: body.editionId, operationId: body.operationId,
      expectedRevisionId: body.expectedRevisionId, actor, manifest: body.manifest,
    });
    return createNoStoreJsonResponse({ revisionId });
  } catch (error) { return failure(error); }
}
