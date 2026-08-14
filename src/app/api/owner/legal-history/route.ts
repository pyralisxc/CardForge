import { DEFAULT_LEGAL_DOCUMENTS, type LegalDocumentSlug } from '@/features/legal/client';
import { getLegalDocumentHistory, LegalDocumentStoreError } from '@/features/legal/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug || !DEFAULT_LEGAL_DOCUMENTS.some((document) => document.slug === slug)) {
    return createApiErrorResponse(400, 'owner_request_invalid', 'Choose a legal document.');
  }
  try {
    return createNoStoreJsonResponse({ history: await getLegalDocumentHistory(slug as LegalDocumentSlug) });
  } catch (error) {
    if (error instanceof LegalDocumentStoreError) {
      return createApiErrorResponse(error.status, 'owner_console_unavailable', error.message);
    }
    console.error('Failed to load legal history:', error);
    return createApiErrorResponse(500, 'owner_console_unavailable', 'Unable to load legal publication history.');
  }
}
