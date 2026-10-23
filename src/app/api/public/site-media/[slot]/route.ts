import { createHash } from 'node:crypto';

import {
  isComposedSiteMediaSlot,
  isHomepageCustomSection,
  getDefaultSiteMedia,
  getSiteMediaContentType,
  isSiteMediaSlot,
} from '@/features/public-site/server';
import { websiteMediaBucketForPath } from '@/features/public-site/server/websiteEditionStore';
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
  const resolved = await resolveLiveWebsitePresentation();
  const media = resolved.media.find((asset) => asset.slot === slot) ?? getDefaultSiteMedia(slot);
  const requestedVersion = new URL(request.url).searchParams.get('v');
  const supabase = getSupabaseServerClient();
  let historicalPath: string | null = null;
  let historicalDigest: string | null = null;
  if (requestedVersion
     && /^(?:website-drafts|brand|founder|landing)\/[a-zA-Z0-9/_.-]+$/u.test(requestedVersion)
     && !resolved.privatePreview && supabase) {
    const candidate = await supabase.rpc('cardforge_website_activated_media_version', {
      p_slot: slot, p_path: requestedVersion,
    });
    if (!candidate.error && Array.isArray(candidate.data) && candidate.data[0]) {
      historicalPath = candidate.data[0].storage_path as string;
      historicalDigest = candidate.data[0].sha256 as string;
    } else return new Response(null, { status: 404 });
  }
  if (isComposedSiteMediaSlot(slot) && !historicalPath) {
    const settings = resolved.configuration;
    const included = [...settings.homepageSections, ...(settings.pages ?? []).flatMap((page) => page.sections)].some((section) => (
      isHomepageCustomSection(section) && section.blocks.some((block) => (
        block.kind === 'image' && block.mediaSlot === slot && slot === `landing.composer.${block.id}`
      ))
    ));
    if (!included) return new Response(null, { status: 404 });
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
  const { data, error } = await supabase.storage.from(websiteMediaBucketForPath(effectivePath)).download(effectivePath);
  if (error || !data) {
    console.error('Failed to read homepage image:', error);
    return new Response(null, { status: 404 });
  }
  if (effectivePath.startsWith('website-drafts/') && !resolved.privatePreview) {
    // Only the currently activated revision or a historically activated
    // immutable version reaches this point. The private native Storage URL
    // remains inaccessible even after website activation.
    const current = resolved.revisionId !== null
      && resolved.media.some(asset => asset.slot === slot && asset.storagePath === effectivePath);
    if (!current && !historicalDigest) return new Response(null, {status:404});
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