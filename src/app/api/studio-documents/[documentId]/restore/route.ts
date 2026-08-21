import { z } from 'zod';

import {
  getCurrentStudioDocumentAccount,
  restoreStudioDocument,
  StudioDocumentAccessError,
  StudioDocumentStoreError,
} from '@/features/studio-documents/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
const idSchema = z.string().uuid();

export async function POST(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const parsedId = idSchema.safeParse((await context.params).documentId);
    if (!parsedId.success) {
      return createApiErrorResponse(400, 'studio_document_invalid', 'A valid Studio document id is required.');
    }
    const account = await getCurrentStudioDocumentAccount();
    const document = await restoreStudioDocument(
      account.ownerUserId,
      parsedId.data,
      account.retentionHours,
    );
    return createNoStoreJsonResponse({ document });
  } catch (error) {
    if (error instanceof StudioDocumentAccessError) {
      return createApiErrorResponse(error.status, 'sign_in_required', error.message);
    }
    if (error instanceof StudioDocumentStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 404 ? 'studio_document_not_found' : 'studio_document_unavailable',
        error.message,
      );
    }
    console.error('Unable to restore the Studio document:', error);
    return createApiErrorResponse(500, 'studio_document_unavailable', 'Unable to restore the Studio document.');
  }
}
