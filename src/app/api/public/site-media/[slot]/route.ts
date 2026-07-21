import { getCachedSiteMedia, isSiteMediaSlot, SITE_MEDIA_BUCKET } from '@/features/public-site/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  const { slot } = await params;
  if (!isSiteMediaSlot(slot)) return new Response(null, { status: 404 });

  const media = (await getCachedSiteMedia()).find((asset) => asset.slot === slot);
  if (!media) return new Response(null, { status: 404 });
  if (!media.storagePath) {
    return Response.redirect(new URL(media.defaultSrc, request.url), 307);
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
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/webp',
    },
  });
}
