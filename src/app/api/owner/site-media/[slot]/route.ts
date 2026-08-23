import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { getOwnerSiteConsolePayload, getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import {
  getSiteMediaStoragePath,
  getSiteMediaContentType,
  getSiteMedia,
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
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slot: string }> }) {
  let uploadedPath: string | null = null;
  let mediaCommitted = false;
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to update public images.');
    const { slot } = await params;
    if (!isSiteMediaSlot(slot)) return createApiErrorResponse(404, 'site_media_not_found', 'Public image not found.');
    const rateLimit = await consumeRateLimit({ action: 'site-media-upload', identity: owner.userId, limit: 24, windowSeconds: 3600 });
    if (!rateLimit.allowed) return createRateLimitErrorResponse('Too many public image publishes.', {
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      resource: 'public_image_publishes',
      maximum: 24,
      unit: 'attempts_per_hour',
    });

    const formData = await request.formData();
    const imageValue = formData.get('image');
    const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
    const alt = normalizeSiteMediaAlt(formData.get('alt'));
    const presentationValue = formData.get('presentation');
    let presentation: unknown;
    try { presentation = typeof presentationValue === 'string' ? JSON.parse(presentationValue) : null; }
    catch { return createApiErrorResponse(400, 'site_media_invalid', 'Image presentation settings are invalid.'); }
    if (!alt) return createApiErrorResponse(400, 'site_media_invalid', 'Add a short description of the image.');

    const current = (await getSiteMedia()).find((asset) => asset.slot === slot);
    if (!current) return createApiErrorResponse(404, 'site_media_not_found', 'Public image not found.');
    const obsoleteStoragePath = current.previousVersion?.storagePath ?? null;
    let storagePath = current.storagePath;
    let width = current.width;
    let height = current.height;

    if (image) {
      const validation = validateSiteMediaFile(image);
      if (!validation.ok) return createApiErrorResponse(image.size > 12 * 1024 * 1024 ? 413 : 400, 'site_media_invalid', validation.message);
      const processed = await processSiteMediaImage(Buffer.from(await image.arrayBuffer()), slot);
      const supabase = getSupabaseServerClient();
      if (!supabase) return createApiErrorResponse(503, 'site_media_unavailable', 'Public image storage is not configured yet.');
      uploadedPath = getSiteMediaStoragePath(slot, randomUUID());
      const { error: uploadError } = await supabase.storage.from(SITE_MEDIA_BUCKET).upload(uploadedPath, processed.buffer, { cacheControl: '31536000', contentType: getSiteMediaContentType(slot), upsert: false });
      if (uploadError) { console.error('Failed to upload public image:', uploadError); return createApiErrorResponse(500, 'site_media_unavailable', 'Unable to upload the public image.'); }
      storagePath = uploadedPath; width = processed.width; height = processed.height;
    }

    await updateSiteMedia({ slot, storagePath, alt, width, height, presentation });
    mediaCommitted = true;
    if (obsoleteStoragePath && obsoleteStoragePath !== current.storagePath && obsoleteStoragePath !== storagePath) {
      const supabase = getSupabaseServerClient();
      const { error: cleanupError } = supabase ? await supabase.storage.from(SITE_MEDIA_BUCKET).remove([obsoleteStoragePath]) : { error: null };
      if (cleanupError) console.error('Failed to remove superseded public image version:', cleanupError);
    }
    revalidateSiteMediaCache();
    revalidatePath('/');
    if (slot.startsWith('brand.')) revalidatePath('/', 'layout');
    if (slot === 'founder.portrait') revalidatePath('/cameron');
    await recordOwnerActivity({ actorUserId: owner.userId, actorEmail: owner.email, action: 'site.media.publish', targetType: 'site_media', targetId: slot, summary: image ? 'Published a new public site image and presentation.' : 'Updated public image presentation and accessibility text.' });
    return createNoStoreJsonResponse({ console: await getOwnerSiteConsolePayload() }, { status: image ? 201 : 200 });
  } catch (error) {
    if (uploadedPath && !mediaCommitted) { const supabase = getSupabaseServerClient(); if (supabase) await supabase.storage.from(SITE_MEDIA_BUCKET).remove([uploadedPath]); }
    if (error instanceof RateLimitUnavailableError) return createApiErrorResponse(503, 'site_media_unavailable', error.message);
    if (error instanceof SiteMediaStoreError) return createApiErrorResponse(error.status, error.status === 503 ? 'site_media_unavailable' : 'site_media_invalid', error.message);
    const message = error instanceof Error && error.message.includes('valid image') ? error.message : 'Unable to publish the public image.';
    console.error('Failed to update public image:', error);
    return createApiErrorResponse(400, 'site_media_invalid', message);
  }
}
