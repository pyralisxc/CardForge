import {
  getStudioDocument,
  getStudioDocumentAssetDownloads,
  readStudioDocumentPreviewToken,
  StudioDocumentStoreError,
} from '@/features/studio-documents/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const payload = readStudioDocumentPreviewToken(token);
  if (!payload) {
    return createApiErrorResponse(
      404,
      'studio_document_not_found',
      'This CardForge draft preview link has expired or is invalid. Return to ChatGPT and ask CardForge to render the latest draft preview again.',
    );
  }

  try {
    const document = await getStudioDocument(payload.ownerUserId, payload.documentId);
    if (document.revision !== payload.revision || document.creationSource !== 'gpt') {
      return createApiErrorResponse(409, 'studio_document_conflict', 'This draft has a newer revision. Ask CardForge to render the latest preview.');
    }
    const template = document.document.userTemplates[0];
    if (!template || document.document.userTemplates.length !== 1) {
      return createApiErrorResponse(409, 'studio_document_conflict', 'This draft cannot be rendered as a single CardForge Template preview.');
    }

    const customFonts = document.document.customFonts ?? [];
    const assets = await getStudioDocumentAssetDownloads({
      ownerUserId: payload.ownerUserId,
      documentId: payload.documentId,
      value: { template, customFonts },
    });
    return createNoStoreJsonResponse({
      title: document.title,
      revision: document.revision,
      template,
      customFonts,
      assets,
    });
  } catch (error) {
    if (error instanceof StudioDocumentStoreError) {
      return createApiErrorResponse(
        error.status === 404 ? 404 : 503,
        error.status === 404 ? 'studio_document_not_found' : 'studio_document_unavailable',
        error.status === 404
          ? 'This CardForge draft preview is no longer available. Return to ChatGPT and render a fresh preview if the draft still exists.'
          : error.message,
      );
    }
    console.error('Unable to render Studio draft preview:', error);
    return createApiErrorResponse(500, 'studio_document_unavailable', 'Unable to render the CardForge draft preview.');
  }
}
