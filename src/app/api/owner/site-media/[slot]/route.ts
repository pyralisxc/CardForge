import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { getOwnerConsolePayload, getCurrentOwnerAccess } from '@/features/owner/server';
import {
  getSiteMediaStoragePath,
  isSiteMediaSlot,
  normalizeSiteMediaAlt,
  processSiteMediaImage,
  revalidateSiteMediaCache,
  SITE_MEDIA_BUCKET,
  SiteMediaStoreError,
  updateSiteMedia,
  validateSiteMediaFile,
} from '@/features/public-site/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  let uploadedPath: string | null = null;
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to update homepage images.');
    }
    const { slot } = await params;
    if (!isSiteMediaSlot(slot)) {
      return createApiErrorResponse(404, 'site_media_not_found', 'Homepage image not found.');
    }
    const rateLimit = await consumeRateLimit({
      action: 'site-media-upload',
      identity: owner.userId,
      limit: 24,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many homepage image uploads. Please try again later.');
    }

    const formData = await request.formData();
    const image = formData.get('image');
    const alt = normalizeSiteMediaAlt(formData.get('alt'));
    if (!(image instanceof File)) {
      return createApiErrorResponse(400, 'site_media_invalid', 'Choose an image to upload.');
    }
    const validation = validateSiteMediaFile(image);
    if (!validation.ok) {
      return createApiErrorResponse(image.size > 12 * 1024 * 1024 ? 413 : 400, 'site_media_invalid', validation.message);
    }
    if (!alt) {
      return createApiErrorResponse(400, 'site_media_invalid', 'Add a short description of the image.');
    }

    const processed = await processSiteMediaImage(Buffer.from(await image.arrayBuffer()), slot);
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return createApiErrorResponse(503, 'site_media_unavailable', 'Homepage image storage is not configured yet.');
    }
    uploadedPath = getSiteMediaStoragePath(slot, randomUUID());
    const { error: uploadError } = await supabase.storage
      .from(SITE_MEDIA_BUCKET)
      .upload(uploadedPath, processed, {
        cacheControl: '31536000',
        contentType: 'image/webp',
        upsert: false,
      });
    if (uploadError) {
      console.error('Failed to upload homepage image:', uploadError);
      return createApiErrorResponse(500, 'site_media_unavailable', 'Unable to upload the homepage image.');
    }

    await updateSiteMedia({ slot, storagePath: uploadedPath, alt });
    revalidateSiteMediaCache();
    revalidatePath('/');

    return createNoStoreJsonResponse({ console: await getOwnerConsolePayload() }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      const supabase = getSupabaseServerClient();
      if (supabase) await supabase.storage.from(SITE_MEDIA_BUCKET).remove([uploadedPath]);
    }
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'site_media_unavailable', error.message);
    }
    if (error instanceof SiteMediaStoreError) {
      return createApiErrorResponse(error.status, error.status === 503 ? 'site_media_unavailable' : 'site_media_invalid', error.message);
    }
    const message = error instanceof Error && error.message.includes('valid image')
      ? error.message
      : 'Unable to publish the homepage image.';
    console.error('Failed to update homepage image:', error);
    return createApiErrorResponse(400, 'site_media_invalid', message);
  }
}
