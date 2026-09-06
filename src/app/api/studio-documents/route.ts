import {
  getCurrentStudioDocumentAccount,
  listDeletedStudioDocumentsPage,
  listStudioDocumentsPage,
  StudioDocumentAccessError,
  StudioDocumentStoreError,
} from '@/features/studio-documents/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const account = await getCurrentStudioDocumentAccount();
    const cursor = Math.max(0, Number(new URL(request.url).searchParams.get('cursor') ?? 0) || 0);
    const documentsPage = await listStudioDocumentsPage(account.ownerUserId, account.retentionHours, cursor);
    const deletedDocumentsPage = await listDeletedStudioDocumentsPage(account.ownerUserId, cursor);
    return createNoStoreJsonResponse({
      documents: documentsPage.documents,
      documentsHasMore: documentsPage.hasMore,
      documentsNextCursor: documentsPage.nextCursor,
      deletedDocuments: deletedDocumentsPage.documents,
      deletedDocumentsHasMore: deletedDocumentsPage.hasMore,
      deletedDocumentsNextCursor: deletedDocumentsPage.nextCursor,
      retentionHours: account.retentionHours,
      recoveryHours: 24,
      watermark: account.watermark,
    });
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
