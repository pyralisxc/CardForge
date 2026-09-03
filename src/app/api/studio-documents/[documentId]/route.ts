import { z } from 'zod';

import {
  deleteStudioDocument,
  getCurrentStudioDocumentAccount,
  getStudioDocument,
  getStudioDocumentAssetDownloads,
  normalizeStudioDocumentPayload,
  normalizeStudioDocumentTitle,
  StudioDocumentAccessError,
  StudioDocumentStoreError,
  updateStudioDocument,
} from '@/features/studio-documents/server';
import {
  parseJsonBodyWithLimit,
  STUDIO_CONTENT_MAX_JSON_BODY_BYTES,
} from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
const idSchema = z.string().uuid();

const readDocumentId = async (context: { params: Promise<{ documentId: string }> }) => {
  const result = idSchema.safeParse((await context.params).documentId);
  return result.success ? result.data : null;
};

const toErrorResponse = (error: unknown, fallback: string) => {
  if (error instanceof StudioDocumentAccessError) {
    return createApiErrorResponse(error.status, 'sign_in_required', error.message);
  }
  if (error instanceof StudioDocumentStoreError) {
    const code = error.status === 404
      ? 'studio_document_not_found'
      : error.status === 409
        ? 'studio_document_conflict'
        : 'studio_document_unavailable';
    return createApiErrorResponse(error.status, code, error.message);
  }
  console.error(fallback, error);
  return createApiErrorResponse(500, 'studio_document_unavailable', fallback);
};

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const documentId = await readDocumentId(context);
    if (!documentId) return createApiErrorResponse(400, 'studio_document_invalid', 'A valid Studio document id is required.');
    const revisionValue = new URL(request.url).searchParams.get('revision');
    const requestedRevision = revisionValue && /^\d+$/u.test(revisionValue) ? Number(revisionValue) : null;
    if (revisionValue !== null && (!Number.isSafeInteger(requestedRevision) || Number(requestedRevision) < 1)) {
      return createApiErrorResponse(400, 'studio_document_invalid', 'A valid positive Studio document revision is required.');
    }
    const account = await getCurrentStudioDocumentAccount();
    const document = await getStudioDocument(account.ownerUserId, documentId, account.retentionHours);
    if (requestedRevision !== null && document.revision !== requestedRevision) {
      throw new StudioDocumentStoreError(
        `This Studio document is now revision ${document.revision}. Reopen the latest revision-bound link before applying it.`,
        409,
      );
    }
    const assets = await getStudioDocumentAssetDownloads({
      ownerUserId: account.ownerUserId,
      documentId,
      value: document.document,
    });
    return createNoStoreJsonResponse({ document, assets, watermark: account.watermark });
  } catch (error) {
    return toErrorResponse(error, 'Unable to load the Studio document.');
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const documentId = await readDocumentId(context);
    if (!documentId) return createApiErrorResponse(400, 'studio_document_invalid', 'A valid Studio document id is required.');
    const parsedBody = await parseJsonBodyWithLimit(request, STUDIO_CONTENT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message,
      );
    }
    const body = parsedBody.data as Record<string, unknown>;
    const title = normalizeStudioDocumentTitle(body.title);
    const document = normalizeStudioDocumentPayload(body.document);
    const expectedRevision = body.expectedRevision;
    if (!title || !document || !Number.isInteger(expectedRevision) || Number(expectedRevision) < 1) {
      return createApiErrorResponse(400, 'studio_document_invalid', 'Title, project document, and current revision are required.');
    }
    const account = await getCurrentStudioDocumentAccount();
    const updated = await updateStudioDocument({
      ownerUserId: account.ownerUserId,
      documentId,
      title,
      document,
      expectedRevision: Number(expectedRevision),
      retentionHours: account.retentionHours,
    });
    const assets = await getStudioDocumentAssetDownloads({
      ownerUserId: account.ownerUserId,
      documentId,
      value: updated.document,
    });
    return createNoStoreJsonResponse({ document: updated, assets, watermark: account.watermark });
  } catch (error) {
    return toErrorResponse(error, 'Unable to update the Studio document.');
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const documentId = await readDocumentId(context);
    if (!documentId) return createApiErrorResponse(400, 'studio_document_invalid', 'A valid Studio document id is required.');
    const account = await getCurrentStudioDocumentAccount();
    await deleteStudioDocument(account.ownerUserId, documentId);
    return createNoStoreJsonResponse({ ok: true });
  } catch (error) {
    return toErrorResponse(error, 'Unable to delete the Studio document.');
  }
}
