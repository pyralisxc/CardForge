import { getCurrentOwnerAccess } from '@/features/owner/server';
import { readWebsiteRevision } from '@/features/public-site/server/websiteEditionStore';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';

export const dynamic = 'force-dynamic';

const authenticated = async () => {
  const owner = await getCurrentOwnerAccess();
  return Boolean(owner.isOwner && owner.userId);
};
export async function POST(request: Request) {
  if (!await authenticated()) return createApiErrorResponse(403, 'owner_access_required', 'Owner access required.');
  const parsed = await parseJsonBodyWithLimit(request);
  if (!parsed.ok) return createApiErrorResponse(parsed.code === 'payload_too_large' ? 413 : 400, parsed.code, parsed.message);
  const body = parsed.data as Record<string, unknown>;
  if (!body || typeof body.revisionId !== 'string') {
    return createApiErrorResponse(400, 'website_revision_invalid', 'Select a saved website revision.');
  }
  try {
    await readWebsiteRevision(body.revisionId);
    const response = createNoStoreJsonResponse({ preview: true });
    response.cookies.set('cf-owner-website-preview', body.revisionId, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      path: '/', maxAge: 60 * 60 * 4,
    });
    return response;
  } catch {
    return createApiErrorResponse(404, 'website_revision_unavailable', 'Saved website revision unavailable.');
  }
}
export async function DELETE() {
  if (!await authenticated()) return createApiErrorResponse(403, 'owner_access_required', 'Owner access required.');
  const response = createNoStoreJsonResponse({ preview: false });
  response.cookies.delete('cf-owner-website-preview');
  return response;
}
