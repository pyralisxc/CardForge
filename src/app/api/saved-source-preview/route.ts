import { readSourcePreviewRequest } from '@/features/studio-documents/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return createNoStoreJsonResponse(await readSourcePreviewRequest(request)); }
  catch (error) {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 503;
    return createApiErrorResponse(status, 'studio_document_unavailable', error instanceof Error ? error.message : 'Exact source is unavailable.');
  }
}
