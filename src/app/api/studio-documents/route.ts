import {
  getCurrentStudioDocumentAccount,
  listStudioDocuments,
  StudioDocumentAccessError,
  StudioDocumentStoreError,
} from '@/features/studio-documents/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const account = await getCurrentStudioDocumentAccount();
    const documents = await listStudioDocuments(account.ownerUserId);
    return createNoStoreJsonResponse({ documents, watermark: account.watermark });
  } catch (error) {
    if (error instanceof StudioDocumentAccessError) {
      return createApiErrorResponse(error.status, 'sign_in_required', error.message);
    }
    if (error instanceof StudioDocumentStoreError) {
      return createApiErrorResponse(error.status, 'studio_document_unavailable', error.message);
    }
    console.error('Failed to list account Studio documents:', error);
    return createApiErrorResponse(500, 'studio_document_unavailable', 'Unable to list Studio documents.');
  }
}
