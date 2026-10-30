import { z } from 'zod';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { reconcileOwnerStudioDocumentDependencies, StudioDocumentStoreError } from '@/features/studio-documents/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
const inputSchema = z.object({ documentId: z.string().uuid(), expectedRevision: z.number().int().positive() }).strict();

/** Reconciles derived metadata only; no authored payload, source list or owner ID is accepted. */
export async function POST(request: Request) {
  try {
    const access = await getCurrentOwnerAccess();
    if (!access.isOwner || !access.userId) return createApiErrorResponse(403, 'catalog_trash_not_permitted', 'Owner access required.');
    const input = inputSchema.safeParse(await request.json());
    if (!input.success) return createApiErrorResponse(400, 'catalog_trash_invalid', 'An exact Studio document and revision are required.');
    const receipt = await reconcileOwnerStudioDocumentDependencies(input.data.documentId, input.data.expectedRevision);
    return createNoStoreJsonResponse(receipt);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error instanceof StudioDocumentStoreError ? error.status : 503;
    return createApiErrorResponse(status, status === 400 ? 'catalog_trash_invalid' : status === 404 ? 'catalog_trash_not_found'
      : status === 409 ? 'catalog_trash_conflict' : 'catalog_trash_unavailable',
    error instanceof StudioDocumentStoreError ? error.message : 'Studio dependency reconciliation is unavailable. Inspect its state before retrying.');
  }
}
