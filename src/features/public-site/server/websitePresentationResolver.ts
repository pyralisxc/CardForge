import { cookies } from 'next/headers';
import { cache } from 'react';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { getPublicSiteConfiguration } from './siteConfigurationStore';
import { getSiteContentBlocks } from './contentStore';
import { getSiteMedia } from './siteMediaStore';
import { readLiveWebsiteRevision, readWebsiteRevision, WebsiteEditionStoreError } from './websiteEditionStore';
import { DEFAULT_SITE_MEDIA, getDefaultSiteMedia, type SiteMediaAsset } from '../model/siteMedia';
import { DEFAULT_SITE_CONTENT_BLOCKS, getDefaultSiteContentBlock, type SiteContentBlock } from '../model/siteContent';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION, type PublicSiteConfiguration } from '../model/siteConfiguration';
import type { WebsitePresentationManifest } from '../model/websitePresentation';

export interface ResolvedWebsitePresentation {
  privatePreview: boolean;
  generation: number | null;
  revisionId: string | null;
  configuration: PublicSiteConfiguration;
  content: SiteContentBlock[];
  media: SiteMediaAsset[];
}
const projectRevision = (revisionId: string, manifest: WebsitePresentationManifest): ResolvedWebsitePresentation => ({
  revisionId,
  privatePreview: false,
  generation: null,
  configuration: manifest.configuration,
  content: manifest.content.map((block) => ({ ...getDefaultSiteContentBlock(block.slug), ...block, updatedAt: null })),
  media: manifest.media.map((ref) => ({ ...getDefaultSiteMedia(ref.slot), ...ref, previousVersion: null, updatedAt: null })),
});

/**
 * One async resolution per server request. Nothing here reads client query
 * parameters, cookies, or other untrusted revision selectors.
 */
const loadLiveWebsitePresentation = async (): Promise<ResolvedWebsitePresentation> => {
  const previewRevision = (await cookies()).get('cf-owner-website-preview')?.value;
  if (previewRevision) {
    const owner = await getCurrentOwnerAccess();
    if (owner.isOwner && owner.userId) {
      // An untrusted cookie is merely a hint: this authorization and exact
      // read are enforced on every request before any draft can render.
      const manifest = await readWebsiteRevision(previewRevision);
      return { ...projectRevision(previewRevision, manifest), privatePreview: true };
    }
  }
  let live: Awaited<ReturnType<typeof readLiveWebsiteRevision>>;
  try {
    live = await readLiveWebsiteRevision();
  } catch (error) {
    // No silent return to mutable flat rows after cutover has begun.
    if (error instanceof WebsiteEditionStoreError) throw error;
    throw new WebsiteEditionStoreError('Live website revision cannot be resolved.', 503);
  }
  if (live.revisionId) return { ...projectRevision(live.revisionId, await readWebsiteRevision(live.revisionId)), generation: live.generation };
  const [configuration, content, media] = await Promise.all([
    getPublicSiteConfiguration().catch(() => DEFAULT_PUBLIC_SITE_CONFIGURATION), getSiteContentBlocks().catch(() => DEFAULT_SITE_CONTENT_BLOCKS), getSiteMedia().catch(() => DEFAULT_SITE_MEDIA.map(asset => getDefaultSiteMedia(asset.slot))),
  ]);
  return { revisionId: null, privatePreview: false, generation: live.generation, configuration, content, media };
};

/** Explicit server-owned Owner access is required even if a revision ID is known. */
export async function resolveOwnerWebsiteRevision(revisionId: string): Promise<ResolvedWebsitePresentation> {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) throw new WebsiteEditionStoreError('Owner access required.', 403);
  return { ...projectRevision(revisionId, await readWebsiteRevision(revisionId)), privatePreview: true };
}

/** Sitemap and crawlers must never inherit an Owner's private preview cookie. */
const loadPublishedWebsitePresentation = async (): Promise<ResolvedWebsitePresentation> => {
 const live=await readLiveWebsiteRevision();
 if(live.revisionId) return {
   ...projectRevision(live.revisionId,await readWebsiteRevision(live.revisionId)),
   generation:live.generation,
 };
 const [configuration,content,media]=await Promise.all([
   getPublicSiteConfiguration().catch(() => DEFAULT_PUBLIC_SITE_CONFIGURATION),getSiteContentBlocks().catch(() => DEFAULT_SITE_CONTENT_BLOCKS),getSiteMedia().catch(() => DEFAULT_SITE_MEDIA.map(asset => getDefaultSiteMedia(asset.slot))),
 ]);
 return {revisionId:null,privatePreview:false,generation:live.generation,configuration,content,media};
};

// Initialize lazily so repository tests that stub unrelated React exports can
// import server boundaries without eagerly invoking the React request cache.
// The same cached function identity is reused for every request; React owns
// per-request memoization, never module-global presentation data.
let cachedLive: ReturnType<typeof cache<typeof loadLiveWebsitePresentation>> | undefined;
let cachedPublished: ReturnType<typeof cache<typeof loadPublishedWebsitePresentation>> | undefined;
export const resolveLiveWebsitePresentation = (): Promise<ResolvedWebsitePresentation> => {
 cachedLive ??= typeof cache === 'function' ? cache(loadLiveWebsitePresentation) : loadLiveWebsitePresentation;
 return cachedLive();
};
export const resolvePublishedWebsitePresentation = (): Promise<ResolvedWebsitePresentation> => {
 cachedPublished ??= typeof cache === 'function' ? cache(loadPublishedWebsitePresentation) : loadPublishedWebsitePresentation;
 return cachedPublished();
};
