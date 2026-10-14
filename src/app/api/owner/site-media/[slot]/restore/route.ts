import { getCurrentOwnerAccess } from '@/features/owner/server';
import { restoreOwnerSiteMedia, OwnerMediaRateLimitError } from '@/features/owner/server/ownerMediaCommands';
import { SiteMediaStoreError } from '@/features/public-site/server';
import { RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ slot: string }> }) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to restore public images.');
    const { slot } = await params;
    const input = await request.json();
    const publication = await restoreOwnerSiteMedia({ actor: { userId: owner.userId, email: owner.email }, slot, expectedUpdatedAt: input.expectedUpdatedAt });
    return createNoStoreJsonResponse({ media: publication.value, receipt: publication.receipt,
      restore: { committed: true, slot, refresh: publication.receipt.refreshComplete && publication.receipt.activityRecorded ? 'complete' : 'unavailable',
        retryable: false, nextAction: publication.receipt.nextAction,
        message: 'Image restored. Reload to verify before another media action. Do not repeat Restore; that would switch versions again.' } });
  } catch (error) {
    if (error instanceof OwnerMediaRateLimitError) return createRateLimitErrorResponse(error.message, { retryAfterSeconds: error.retryAfterSeconds, ...error.limit });
    if (error instanceof SiteMediaStoreError) return createApiErrorResponse(error.status, error.status >= 500 ? 'site_media_unavailable' : 'site_media_invalid', error.message);
    if (error instanceof RateLimitUnavailableError) return createApiErrorResponse(503, 'site_media_unavailable', error.message);
    if (error instanceof SyntaxError) return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    console.error('Failed to restore public image:', error);
    return createApiErrorResponse(500, 'site_media_unavailable', 'Unable to restore the previous public image.');
  }
}
