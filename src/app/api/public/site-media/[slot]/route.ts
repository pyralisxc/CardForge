import { createHash } from 'node:crypto';

import {
  getCachedPublicSiteConfiguration,
  isComposedSiteMediaSlot,
  isHomepageCustomSection,
  getDefaultSiteMedia,
  getSiteMediaContentType,
  isSiteMediaSlot,
  SITE_MEDIA_BUCKET,
} from '@/features/public-site/server';
import { resolveLiveWebsitePresentation } from '@/features/public-site/server/websitePresentationResolver';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export const dynamic = 'force-dynamic';

const crawlerFacingStableAlias = (slot: string): boolean => (
  slot === 'brand.social' || slot === 'brand.favicon'
);

const mediaRevisionEtag = (media: {
  slot: string;
  storagePath: string | null;
  defaultSrc: string | null;
  updatedAt: string | null;
}): string => {
  const revision = [
    media.slot,
    media.storagePath ?? 'default',
    media.updatedAt ?? media.defaultSrc ?? 'missing',
  ].join(':');
  return `"cf-site-media-${createHash('sha256').update(revision).digest('hex').slice(0, 24)}"`;
};

const cacheControlFor = (slot: string, versioned: boolean): string => {
  if (versioned) return 'public, max-age=31536000, immutable';
  if (crawlerFacingStableAlias(slot)) return 'public, max-age=0, must-revalidate';
  return 'public, max-age=300, stale-while-revalidate=3600';
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  const { slot } = await params;
  if (!isSiteMediaSlot(slot)) return new Response(null, { status: 404 });
  if (isComposedSiteMediaSlot(slot)) {
    const settings = await getCachedPublicSiteConfiguration();
    const included = settings.homepageSections.some((section) => (
      isHomepageCustomSection(section) && section.blocks.some((block) => (
        block.kind === 'image' && block.mediaSlot === slot && slot === `landing.composer.${block.id}`
      ))
    ));
    if (!included) return new Response(null, { status: 404 });
  }

  const resolved = await resolveLiveWebsitePresentation();
  const media = resolved.media.find((asset) => asset.slot === slot) ?? getDefaultSiteMedia(slot);
  const requestedVersion = new URL(request.url).searchParams.get('v');
  const supabase = getSupabaseServerClient();
  let historicalPath: string | null = null;
  let historicalDigest: string | null = null;
  if (requestedVersion && requestedVersion !== media.storagePath
     && /^(?:brand|founder|landing)\/[a-zA-Z0-9/_.-]+$/u.test(requestedVersion)
     && !resolved.privatePreview && supabase) {
    const candidate = await supabase.rpc('cardforge_website_activated_media_version', {
      p_slot: slot, p_path: requestedVersion,
    });
    if (!candidate.error && Array.isArray(candidate.data) && candidate.data[0]) {
      historicalPath = candidate.data[0].storage_path as string;
      historicalDigest = candidate.data[0].sha256 as string;
    } else return new Response(null, { status: 404 });
  }
  const effectivePath = historicalPath ?? media.storagePath;
  const versioned = requestedVersion !== null && requestedVersion === effectivePath && effectivePath !== null;
  const etag = mediaRevisionEtag({ ...media, storagePath: effectivePath });
  const cacheControl = resolved.privatePreview ? 'private, no-store' : cacheControlFor(slot, versioned);
  // Anonymous public image bytes must stay usable in creator canvas exports
  // across app/deployment origins, including fallback redirects and 304s.
  const publicImageHeaders = { 'Access-Control-Allow-Origin': '*' };
  if (!versioned && crawlerFacingStableAlias(slot) && request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ...publicImageHeaders,
        'Cache-Control': cacheControl,
        ETag: etag,
      },
    });
  }
  if (!effectivePath) {
    if (!media.defaultSrc) return new Response(null, { status: 404 });
    return new Response(null, {
      status: 307,
      headers: {
        ...publicImageHeaders,
        Location: media.defaultSrc,
        'Cache-Control': cacheControl,
        ETag: etag,
      },
    });
  }

  if (!supabase) return new Response(null, { status: 503 });
  const { data, error } = await supabase.storage.from(SITE_MEDIA_BUCKET).download(effectivePath);
  if (error || !data) {
    console.error('Failed to read homepage image:', error);
    return new Response(null, { status: 404 });
  }
  if (historicalDigest) {
    const actual = createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex');
    if (actual !== historicalDigest) return new Response(null, { status: 503 });
  }
  return new Response(data, {
    headers: {
      'Cache-Control': cacheControl,
      ...publicImageHeaders,
      'Content-Type': getSiteMediaContentType(slot),
      ETag: etag,
    },
  });
}