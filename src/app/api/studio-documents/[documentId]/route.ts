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
  readStudioOutputIntent, validateOutputIntentDocument,
  readPrivateStudioTemplate,
} from '@/features/studio-documents/server';
import {
  parseJsonBodyWithLimit,
  STUDIO_CONTENT_MAX_JSON_BODY_BYTES,
} from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
const idSchema = z.guid();

// A valid portable document can carry more metadata than a buffered function
// response permits. Preserve the ordinary JSON contract while streaming it.
const streamDocumentResponse = (value: unknown): Response => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let offset = 0;
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.subarray(offset, offset += 64 * 1024));
    },
  }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
};

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
    const outputRef = new URL(request.url).searchParams.get('outputRef');
    if (outputRef !== null && (!idSchema.safeParse(outputRef).success || requestedRevision === null)) {
      return createApiErrorResponse(400, 'studio_document_invalid', 'A valid Output reference and exact revision are required.');
    }
    const account = await getCurrentStudioDocumentAccount();
    const outputIntent = outputRef ? await readStudioOutputIntent(account.ownerUserId, documentId, outputRef) : undefined;
    if (outputIntent && outputIntent.revision !== requestedRevision) return createApiErrorResponse(409, 'studio_document_conflict', 'The Output revision does not match.');
    const document = await getStudioDocument(account.ownerUserId, documentId, account.retentionHours, outputIntent ? (raw) => {
      try { validateOutputIntentDocument(outputIntent!, raw); }
      catch (error) { throw new StudioDocumentStoreError(error instanceof Error ? error.message : 'The output source is invalid.', 409); }
    } : undefined);
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
      requireVerifiedSize: Boolean(outputIntent),
    });
    return streamDocumentResponse({ document, assets, watermark: account.watermark, ...(outputIntent ? { outputIntent } : {}) });
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
    if (body.templateAssetId !== undefined) {
      if (typeof body.templateAssetId !== 'string' || !/^[a-f0-9]{64}$/u.test(body.templateAssetId) || body.template !== undefined || body.document !== undefined) return createApiErrorResponse(400, 'studio_document_invalid', 'The Template transfer is invalid.');
    }
    const expectedRevision = body.expectedRevision;
    const account = await getCurrentStudioDocumentAccount();
    if (typeof body.templateAssetId === 'string') body.template = await readPrivateStudioTemplate(account.ownerUserId, documentId, body.templateAssetId);
    let title = normalizeStudioDocumentTitle(body.title);
    let document = normalizeStudioDocumentPayload(body.document);
    if (body.template && typeof body.template === 'object' && !Array.isArray(body.template)) {
      const template = body.template as Record<string, unknown>;
      if (typeof template.id !== 'string' || !Number.isInteger(expectedRevision) || Number(expectedRevision) < 1) return createApiErrorResponse(400, 'studio_document_invalid', 'A Template and current revision are required.');
      const current = await getStudioDocument(account.ownerUserId, documentId, account.retentionHours);
      if (current.revision !== expectedRevision) throw new StudioDocumentStoreError('The Studio draft changed. Reopen its current revision before saving.', 409);
      const index = current.document.userTemplates.findIndex((item) => item.id === template.id);
      if (index < 0) throw new StudioDocumentStoreError('The linked Template is no longer present.', 409);
      const templates = [...current.document.userTemplates];
      templates[index] = template as unknown as typeof templates[number];
      document = normalizeStudioDocumentPayload({ ...current.document, userTemplates: templates });
      title = current.title;
    }
    if (!title || !document || !Number.isInteger(expectedRevision) || Number(expectedRevision) < 1) {
      return createApiErrorResponse(400, 'studio_document_invalid', 'Title, project document, and current revision are required.');
    }
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
