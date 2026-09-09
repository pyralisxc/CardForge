import { revalidatePath } from 'next/cache';

import { getCurrentOwnerAccess, getOwnerSiteOperationsPayload, recordOwnerActivity } from '@/features/owner/server';
import {
  isSiteMediaSlot,
  restorePreviousSiteMedia,
  revalidateSiteMediaCache,
  SiteMediaStoreError,
} from '@/features/public-site/server';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ slot: string }> }) {
  let restoredSlot: string | null = null;
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to restore public images.');
    const { slot } = await params;
    if (!isSiteMediaSlot(slot)) return createApiErrorResponse(404, 'site_media_not_found', 'Public image not found.');
    const rateLimit = await consumeRateLimit({ action: 'site-media-restore', identity: owner.userId, limit: 24, windowSeconds: 3600 });
    if (!rateLimit.allowed) return createRateLimitErrorResponse('Too many image restores.', {
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      resource: 'public_image_restores',
      maximum: 24,
      unit: 'attempts_per_hour',
    });

    await restorePreviousSiteMedia(slot);
    restoredSlot = slot;
    revalidateSiteMediaCache();
    revalidatePath('/');
    if (slot.startsWith('brand.')) revalidatePath('/', 'layout');
    if (slot === 'founder.portrait') revalidatePath('/cameron');
    const activityRecorded = await recordOwnerActivity({ actorUserId: owner.userId, actorEmail: owner.email, action: 'site.media.restore', targetType: 'site_media', targetId: slot, summary: 'Restored the previous public site image version.' });
    if (!activityRecorded) throw new Error('The restored image could not be recorded in owner history.');
    return createNoStoreJsonResponse({
      restore: { committed: true, slot, refresh: 'complete', retryable: false },
      operations: await getOwnerSiteOperationsPayload(),
    });
  } catch (error) {
    if (restoredSlot) {
      console.error('Public image restored; follow-up refresh unavailable:', error);
      return createNoStoreJsonResponse({
        restore: {
          committed: true, slot: restoredSlot, refresh: 'unavailable', retryable: false, nextAction: 'reload',
          message: 'The previous image was restored, but the refreshed view or owner history is unavailable. Reload to verify it. Do not repeat Restore; that would switch versions again.',
        },
      });
    }
    if (error instanceof RateLimitUnavailableError) return createApiErrorResponse(503, 'site_media_unavailable', error.message);
    if (error instanceof SiteMediaStoreError) return createApiErrorResponse(error.status, error.status >= 500 ? 'site_media_unavailable' : 'site_media_invalid', error.message);
    console.error('Failed to restore public image:', error);
    return createApiErrorResponse(500, 'site_media_unavailable', 'Unable to restore the previous public image.');
  }
}
