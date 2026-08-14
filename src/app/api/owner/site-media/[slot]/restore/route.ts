import { revalidatePath } from 'next/cache';

import { getCurrentOwnerAccess, getOwnerConsolePayload, recordOwnerActivity } from '@/features/owner/server';
import {
  isSiteMediaSlot,
  restorePreviousSiteMedia,
  revalidateSiteMediaCache,
  SiteMediaStoreError,
} from '@/features/public-site/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to restore public images.');
    }
    const { slot } = await params;
    if (!isSiteMediaSlot(slot)) {
      return createApiErrorResponse(404, 'site_media_not_found', 'Public image not found.');
    }
    const rateLimit = await consumeRateLimit({
      action: 'site-media-restore',
      identity: owner.userId,
      limit: 24,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many image restores. Please try again later.');
    }

    await restorePreviousSiteMedia(slot);
    revalidateSiteMediaCache();
    revalidatePath('/');
    if (slot === 'founder.portrait') revalidatePath('/cameron');
    await recordOwnerActivity({ actorUserId: owner.userId, actorEmail: owner.email, action: 'site.media.restore', targetType: 'site_media', targetId: slot, summary: 'Restored the previous public site image version.' });
    return createNoStoreJsonResponse({ console: await getOwnerConsolePayload() });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'site_media_unavailable', error.message);
    }
    if (error instanceof SiteMediaStoreError) {
      return createApiErrorResponse(error.status, 'site_media_invalid', error.message);
    }
    console.error('Failed to restore public image:', error);
    return createApiErrorResponse(500, 'site_media_unavailable', 'Unable to restore the previous public image.');
  }
}
