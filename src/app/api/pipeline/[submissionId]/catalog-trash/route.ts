import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { changeCatalogTrash, readCatalogTrash, PipelineRegistryCommandError, revalidateCardForgeCatalog } from '@/features/pipeline/server';

type Context = { params: Promise<{ submissionId: string }> };
function failure(error: unknown) {
  return createApiErrorResponse(error instanceof SyntaxError ? 400 : error instanceof PipelineRegistryCommandError ? error.status : 503,
    error instanceof SyntaxError ? 'catalog_trash_invalid' : error instanceof PipelineRegistryCommandError
      ? error.status === 409 ? 'catalog_trash_conflict' : error.status === 404 ? 'catalog_trash_not_found'
        : error.status === 400 ? 'catalog_trash_invalid' : error.status === 403 ? 'catalog_trash_not_permitted' : 'catalog_trash_unavailable'
      : 'catalog_trash_unavailable',
    error instanceof PipelineRegistryCommandError ? error.message : 'Catalog recovery is unavailable. Read its state before retrying.');
}
export async function GET(_request: Request, { params }: Context) {
  const access = await getCurrentOwnerAccess();
  if (!access.isOwner || !access.userId) return createApiErrorResponse(403, 'catalog_trash_not_permitted', 'Owner access required.');
  try { return createNoStoreJsonResponse(await readCatalogTrash(access.userId, (await params).submissionId)); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: Context) {
  const access = await getCurrentOwnerAccess();
  if (!access.isOwner || !access.userId) return createApiErrorResponse(403, 'catalog_trash_not_permitted', 'Owner access required.');
  try {
    const input = await request.json();
    if (input?.expected?.identity?.submissionId !== (await params).submissionId) {
      return createApiErrorResponse(400, 'catalog_trash_invalid', 'Request and route must identify the same submission.');
    }
    const receipt = await changeCatalogTrash(access.userId, input);
    revalidateCardForgeCatalog();
    return createNoStoreJsonResponse(receipt);
  } catch (error) { return failure(error); }
}
