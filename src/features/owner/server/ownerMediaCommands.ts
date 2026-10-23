import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';
import {
  getSiteMedia, getSiteMediaStoragePath, getSiteMediaContentType, isSiteMediaSlot,
  normalizeSiteMediaAlt, normalizeSiteMediaPresentation, processSiteMediaImage, revalidateSiteMediaCache, SITE_MEDIA_BUCKET,
  SiteMediaStoreError, updateSiteMedia, validateSiteMediaFile, restorePreviousSiteMedia,
  assertComposedSiteMediaReference, getDefaultSiteMedia, isComposedSiteMediaSlot,
} from '@/features/public-site/server';
import { WEBSITE_DRAFT_MEDIA_BUCKET, websiteMediaBucketForPath } from '@/features/public-site/server/websiteEditionStore';
import { finalizeOwnerPublication, type OwnerCommandActor } from './ownerSiteCommands';

export class OwnerMediaRateLimitError extends SiteMediaStoreError {
  readonly limit = { resource: 'public_image_operations', maximum: 24, unit: 'attempts_per_hour' };
  constructor(public readonly retryAfterSeconds: number) { super('Too many public image operations.', 429); }
}
const authorizeMediaAttempt = async (actor: OwnerCommandActor, action: string) => {
  const limit = await consumeRateLimit({ action, identity: actor.userId, limit: 24, windowSeconds: 3600 });
  if (!limit.allowed) throw new OwnerMediaRateLimitError(limit.retryAfterSeconds);
};
const refreshSteps = (slot: string) => [
  { label: 'media-cache', run: revalidateSiteMediaCache },
  { label: 'homepage', run: () => revalidatePath('/') },
  ...(slot.startsWith('brand.') ? [{ label: 'public-layout', run: () => revalidatePath('/', 'layout') }] : []),
  ...(slot === 'founder.portrait' ? [{ label: 'founder-page', run: () => revalidatePath('/cameron') }] : []),
];
const removeUncommittedUpload = async (path: string) => {
  try {
    const client = getSupabaseServerClient();
    if (client) {
      // Immutable edition history retains Storage objects even when the live
      // mutable slot has advanced. Provider cleanup cannot delete these bytes.
      const retained = await client.from('cardforge_website_revision_media')
        .select('revision_id').eq('storage_path', path).limit(1);
      if (retained.error) {
        console.error('Unable to verify website media retention; leaving storage object intact:', retained.error);
        return;
      }
      if (retained.data?.length) return;
      const { error } = await client.storage.from(SITE_MEDIA_BUCKET).remove([path]);
      if (error) console.error('Uncommitted image cleanup unavailable:', error);
    }
  } catch (error) { console.error('Uncommitted image cleanup unavailable:', error); }
};

export const publishOwnerSiteMedia = async ({ actor, slot, image, alt: altInput, presentation, expectedUpdatedAt }: {
  actor: OwnerCommandActor; slot: string; image?: File | null; alt: unknown; presentation: unknown; expectedUpdatedAt: unknown;
}) => {
  if (!isSiteMediaSlot(slot)) throw new SiteMediaStoreError('Public image not found.', 404);
  await assertComposedSiteMediaReference(slot);
  await authorizeMediaAttempt(actor, 'site-media-upload');
  const alt = normalizeSiteMediaAlt(altInput);
  if (!alt) throw new SiteMediaStoreError('Add a short description of the image.', 400);
  const current = (await getSiteMedia()).find((asset) => asset.slot === slot)
    ?? (isComposedSiteMediaSlot(slot) ? getDefaultSiteMedia(slot) : undefined);
  if (!current) throw new SiteMediaStoreError('Public image not found.', 404);
  if (current.updatedAt !== expectedUpdatedAt) throw new SiteMediaStoreError('The image changed since it was loaded. Reload and review before publication.', 409);
  let uploadedPath: string | null = null;
  let committed = false;
  try {
    let { storagePath, width, height } = current;
    if (image) {
      const validation = validateSiteMediaFile(image);
      if (!validation.ok) throw new SiteMediaStoreError(validation.message, image.size > 12 * 1024 * 1024 ? 413 : 400);
      const processed = await processSiteMediaImage(Buffer.from(await image.arrayBuffer()), slot)
        .catch(() => { throw new SiteMediaStoreError('Upload a valid JPEG, PNG, or WebP image.', 400); });
      const client = getSupabaseServerClient();
      if (!client) throw new SiteMediaStoreError('Public image storage is not configured yet.', 503);
      uploadedPath = getSiteMediaStoragePath(slot, randomUUID());
      const { error } = await client.storage.from(SITE_MEDIA_BUCKET).upload(uploadedPath, processed.buffer,
        { cacheControl: '31536000', contentType: getSiteMediaContentType(slot), upsert: false });
      if (error) throw new SiteMediaStoreError('Unable to upload the public image.', 503);
      storagePath = uploadedPath; width = processed.width; height = processed.height;
    }
    const value = await updateSiteMedia({ slot, storagePath, width, height, alt, presentation, expectedUpdatedAt });
    committed = true;
    const obsoletePath = current.previousVersion?.storagePath;
    if (obsoletePath && obsoletePath !== current.storagePath && obsoletePath !== storagePath) await removeUncommittedUpload(obsoletePath);
    return finalizeOwnerPublication({ actor, value, action: 'site.media.publish', targetType: 'site_media', targetId: slot,
      summary: image ? 'Published a new public site image and presentation.' : 'Updated public image presentation and accessibility text.',
      subject: value.label, refreshSteps: refreshSteps(slot) });
  } catch (error) {
    // A transport/database failure may follow a committed write. Retain bytes
    // unless the store conclusively rejected the write before commitment.
    if (uploadedPath && !committed && error instanceof SiteMediaStoreError && [400, 409].includes(error.status)) {
      await removeUncommittedUpload(uploadedPath);
    }
    throw error;
  }
};

export const restoreOwnerSiteMedia = async ({ actor, slot, expectedUpdatedAt }: {
  actor: OwnerCommandActor; slot: string; expectedUpdatedAt: unknown;
}) => {
  if (!isSiteMediaSlot(slot)) throw new SiteMediaStoreError('Public image not found.', 404);
  await assertComposedSiteMediaReference(slot);
  await authorizeMediaAttempt(actor, 'site-media-restore');
  const value = await restorePreviousSiteMedia(slot, expectedUpdatedAt);
  return finalizeOwnerPublication({ actor, value, action: 'site.media.restore', targetType: 'site_media', targetId: slot,
    summary: 'Restored the previous public site image version.', subject: value.label, refreshSteps: refreshSteps(slot) });
};

/** Owner image staging reuses the canonical public-media upload/processing owner.
 * No flat slot is published; the exact reference travels only with a saved edition.
 */
export async function stageOwnerWebsiteEditionMedia(input: {
 actor: OwnerCommandActor; slot: string; image: File | null; currentStoragePath: string | null;
 alt: string; presentation: unknown;
}): Promise<{ media: import('@/features/public-site/server').SiteMediaAsset; sha256: string | null }> {
 if (!isSiteMediaSlot(input.slot)) throw new SiteMediaStoreError('Unknown website image.',400);
 await authorizeMediaAttempt(input.actor,'site-media-upload');
 const alt=normalizeSiteMediaAlt(input.alt);
 if (!alt) throw new SiteMediaStoreError('Image description is required.',400);
 const presentation=normalizeSiteMediaPresentation(input.slot,input.presentation);
 if (!presentation.ok) throw new SiteMediaStoreError(presentation.message,400);
 const db=getSupabaseServerClient();
 if (!db) throw new SiteMediaStoreError('Public image storage unavailable.',503);
 const fallback=getDefaultSiteMedia(input.slot);
 let storagePath=input.currentStoragePath;
 let width=fallback.width; let height=fallback.height;
 let sha256: string|null=null;
 if(input.image) {
   // cardforge-public-media is a public Storage bucket. Placing unpublished
   // bytes there would bypass Owner preview authorization via native URLs.
   // Hold image staging until the existing Storage owner has a private,
   // access-controlled destination and explicit activation transition.
   const checked=validateSiteMediaFile(input.image);
   if(!checked.ok) throw new SiteMediaStoreError(checked.message,400);
   const processed=await processSiteMediaImage(Buffer.from(await input.image.arrayBuffer()),input.slot);
   storagePath='website-drafts/'+getSiteMediaStoragePath(input.slot,randomUUID());
   const uploaded=await db.storage.from(WEBSITE_DRAFT_MEDIA_BUCKET).upload(storagePath,processed.buffer,{
     cacheControl:'0',contentType:getSiteMediaContentType(input.slot),upsert:false,
   });
   if(uploaded.error) throw new SiteMediaStoreError('Protected website draft storage unavailable; no image was staged.',503);
   width=processed.width;height=processed.height;
   sha256=createHash('sha256').update(processed.buffer).digest('hex');
 } else if(storagePath) {
   const data=await db.storage.from(websiteMediaBucketForPath(storagePath)).download(storagePath);
   if(data.error||!data.data) throw new SiteMediaStoreError('Selected website image is no longer readable.',409);
   sha256=createHash('sha256').update(Buffer.from(await data.data.arrayBuffer())).digest('hex');
 }
 return {media:{...fallback,storagePath,alt,width,height,presentation:presentation.value,updatedAt:null,previousVersion:null},sha256};
}
