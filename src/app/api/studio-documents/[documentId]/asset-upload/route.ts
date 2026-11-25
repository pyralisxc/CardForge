import { z } from 'zod';
import { getCurrentStudioDocumentAccount, getStudioDocument, preparePrivateStudioAssetUpload, StudioDocumentAccessError, StudioDocumentStoreError } from '@/features/studio-documents/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';

export const dynamic = 'force-dynamic';
const input = z.object({ id: z.string().regex(/^[a-f0-9]{64}$/u), mimeType: z.string().max(100), size: z.number().int().positive(), expectedRevision: z.number().int().positive() }).strict();

export async function POST(request: Request, context: { params: Promise<{ documentId: string }> }) {
  try {
    const documentId = z.guid().safeParse((await context.params).documentId);
    if (!documentId.success) return createApiErrorResponse(400, 'studio_document_invalid', 'A valid Studio document is required.');
    const body = await parseJsonBodyWithLimit(request);
    if (!body.ok) return createApiErrorResponse(body.code === 'payload_too_large' ? 413 : 400, body.code, body.message);
    const parsed = input.safeParse(body.data);
    if (!parsed.success) return createApiErrorResponse(400, 'studio_document_invalid', 'Valid asset metadata and an exact revision are required.');
    const account = await getCurrentStudioDocumentAccount();
    const document = await getStudioDocument(account.ownerUserId, documentId.data, account.retentionHours);
    if (document.revision !== parsed.data.expectedRevision) throw new StudioDocumentStoreError('The Studio draft changed before the artwork transfer. Reload it before saving.', 409);
    const upload = await preparePrivateStudioAssetUpload({ ownerUserId: account.ownerUserId, documentId: documentId.data, ...parsed.data });
    return createNoStoreJsonResponse({ upload });
  } catch (error) {
    if (error instanceof StudioDocumentAccessError || error instanceof StudioDocumentStoreError) return createApiErrorResponse(error.status, error.status === 409 ? 'studio_document_conflict' : 'studio_document_unavailable', error.message);
    console.error('Unable to prepare private Studio artwork:', error);
    return createApiErrorResponse(503, 'studio_document_unavailable', 'Unable to prepare the private artwork transfer.');
  }
}
