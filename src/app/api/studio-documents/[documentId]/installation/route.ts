import { z } from 'zod';

import {
  getCurrentStudioDocumentAccount,
  recordStudioDocumentInstallation,
  StudioDocumentAccessError,
  StudioDocumentStoreError,
} from '@/features/studio-documents/server';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
const summarySchema = z.object({
  templateCount: z.number().int().min(0).max(500),
  templateAddedCount: z.number().int().min(0).max(500),
  templateUpdatedCount: z.number().int().min(0).max(500),
  setCount: z.number().int().min(0).max(500),
  cardCount: z.number().int().min(0).max(10000),
  cardAddedCount: z.number().int().min(0).max(10000),
  cardUpdatedCount: z.number().int().min(0).max(10000),
  cardSkippedCount: z.number().int().min(0).max(10000),
  activeSetId: z.string().max(255).nullable(),
  destination: z.enum(['template-maker', 'generator', 'sets']),
}).strict();

const bodySchema = z.object({
  revision: z.number().int().min(1),
  summary: summarySchema,
}).strict();

const toErrorResponse = (error: unknown) => {
  if (error instanceof StudioDocumentAccessError) {
    return createApiErrorResponse(error.status, 'sign_in_required', error.message);
  }
  if (error instanceof StudioDocumentStoreError) {
    return createApiErrorResponse(
      error.status,
      error.status === 409 ? 'studio_document_conflict' : 'studio_document_unavailable',
      error.message,
    );
  }
  console.error('Unable to acknowledge Studio installation:', error);
  return createApiErrorResponse(500, 'studio_document_unavailable', 'Unable to acknowledge the installed CardForge revision.');
};

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const documentIdResult = idSchema.safeParse((await context.params).documentId);
    if (!documentIdResult.success) {
      return createApiErrorResponse(400, 'studio_document_invalid', 'A valid Studio document id is required.');
    }
    const parsedBody = await parseJsonBodyWithLimit(request, 32 * 1024);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message,
      );
    }
    const body = bodySchema.safeParse(parsedBody.data);
    if (!body.success) {
      return createApiErrorResponse(400, 'studio_document_invalid', 'The installed revision summary is invalid.');
    }
    const account = await getCurrentStudioDocumentAccount();
    const document = await recordStudioDocumentInstallation({
      ownerUserId: account.ownerUserId,
      documentId: documentIdResult.data,
      revision: body.data.revision,
      summary: body.data.summary,
    });
    return createNoStoreJsonResponse({
      ok: true,
      documentId: document.id,
      revision: document.revision,
      lastInstalledRevision: document.lastInstalledRevision,
      lastInstalledAt: document.lastInstalledAt,
      summary: document.lastInstallSummary,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
