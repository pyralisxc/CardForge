import { createHash } from 'node:crypto';

import {
  getCachedSiteMedia,
  getDefaultSiteMedia,
  getSiteMediaContentType,
  isSiteMediaSlot,
  SITE_MEDIA_BUCKET,
} from '@/features/public-site/server';
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

  const media = (await getCachedSiteMedia()).find((asset) => asset.slot === slot)
    ?? getDefaultSiteMedia(slot);
  const versioned = new URL(request.url).searchParams.has('v');
  const etag = mediaRevisionEtag(media);
  const cacheControl = cacheControlFor(slot, versioned);
  if (!versioned && crawlerFacingStableAlias(slot) && request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        'Cache-Control': cacheControl,
        ETag: etag,
      },
    });
  }
  if (!media.storagePath) {
    if (!media.defaultSrc) return new Response(null, { status: 404 });
    return new Response(null, {
      status: 307,
      headers: {
        Location: media.defaultSrc,
        'Cache-Control': cacheControl,
        ETag: etag,
      },
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return new Response(null, { status: 503 });
  const { data, error } = await supabase.storage.from(SITE_MEDIA_BUCKET).download(media.storagePath);
  if (error || !data) {
    console.error('Failed to read homepage image:', error);
    return new Response(null, { status: 404 });
  }
  return new Response(data, {
    headers: {
      'Cache-Control': cacheControl,
      'Content-Type': getSiteMediaContentType(slot),
      ETag: etag,
    },
  });
}