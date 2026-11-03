import { getCurrentOwnerAccess } from '@/features/owner/server';
import { getOwnerStudioDependencies, reconcileOwnerStudioDependencies } from '@/features/owner/server/ownerStudioDependencyCommands';
import { StudioDocumentStoreError } from '@/features/studio-documents/server';
import { AccountToolAccessError } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
async function handle(request: Request, write: boolean) {
  try {
    const access = await getCurrentOwnerAccess();
    if (!access.isOwner || !access.userId) return createApiErrorResponse(403, 'catalog_trash_not_permitted', 'Owner access required.');
    const url = new URL(request.url), rawRevision = url.searchParams.get('expectedRevision');
    const input = write ? await request.json() : { ...Object.fromEntries(url.searchParams), expectedRevision: rawRevision ? Number(rawRevision) : undefined };
    const result = write ? await reconcileOwnerStudioDependencies(access.userId, input) : await getOwnerStudioDependencies(access.userId, input);
    if ('receipt' in result && result.receipt.outcome === 'uncertain') {
      const unavailable = createApiErrorResponse(503, 'catalog_trash_unavailable', result.receipt.warnings.join(' '), { retryable: false, nextAction: 'Read exact persisted dependency metadata; do not replay automatically.' });
      return createNoStoreJsonResponse({ ...(await unavailable.json()), ...result }, { status: 503, headers: unavailable.headers });
    }
    return createNoStoreJsonResponse(result);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error instanceof StudioDocumentStoreError || error instanceof AccountToolAccessError ? error.status : 503;
    return createApiErrorResponse(status, status === 400 ? 'catalog_trash_invalid' : status === 403 ? 'catalog_trash_not_permitted' : status === 404 ? 'catalog_trash_not_found' : status === 409 ? 'catalog_trash_conflict' : 'catalog_trash_unavailable',
      error instanceof StudioDocumentStoreError || error instanceof AccountToolAccessError ? error.message : 'Studio dependency state is unavailable. Read exact persisted metadata before any further write.');
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
