import { getCurrentOwnerAccess } from '@/features/owner/server';
import { publishOwnerSiteMedia, OwnerMediaRateLimitError } from '@/features/owner/server/ownerMediaCommands';
import { SiteMediaStoreError } from '@/features/public-site/server';
import { RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ slot: string }> }) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to update public images.');
    const { slot } = await params;
    const form = await request.formData();
    const candidate = form.get('image');
    const revision = form.get('expectedUpdatedAt');
    const presentation = JSON.parse(String(form.get('presentation') ?? '{}'));
    const publication = await publishOwnerSiteMedia({ actor: { userId: owner.userId, email: owner.email }, slot,
      image: candidate instanceof File && candidate.size > 0 ? candidate : null,
      alt: form.get('alt'), presentation, expectedUpdatedAt: revision === 'null' ? null : revision });
    return createNoStoreJsonResponse({ media: publication.value, receipt: publication.receipt }, { status: candidate instanceof File ? 201 : 200 });
  } catch (error) {
    if (error instanceof OwnerMediaRateLimitError) return createRateLimitErrorResponse(error.message, { retryAfterSeconds: error.retryAfterSeconds, ...error.limit });
    if (error instanceof SiteMediaStoreError) return createApiErrorResponse(error.status, error.status >= 500 ? 'site_media_unavailable' : 'site_media_invalid', error.message);
    if (error instanceof RateLimitUnavailableError) return createApiErrorResponse(503, 'site_media_unavailable', error.message);
    if (error instanceof SyntaxError) return createApiErrorResponse(400, 'site_media_invalid', 'Image presentation settings are invalid.');
    console.error('Failed to publish public image:', error);
    return createApiErrorResponse(500, 'site_media_unavailable', 'Unable to publish the public image.');
  }
}
