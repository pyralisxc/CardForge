import { randomUUID } from 'node:crypto';

import {
  createDeveloperCockpitErrorResponse,
  getCurrentDeveloperCockpitAccess,
  MAX_SOCIAL_MEDIA_BYTES,
  processSocialMediaImage,
  requireContributionScope,
  SOCIAL_SOURCE_BUCKET,
  validateSocialMediaFile,
} from '@/features/developer-cockpit/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  createApiErrorResponse,
  createNoStoreJsonResponse,
} from '@/infrastructure/http/apiResponses';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const isSafePath = (value: string) =>
  Boolean(value) && !value.startsWith('/') && !value.includes('..') && value.length <= 500;

export async function GET(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const path = new URL(request.url).searchParams.get('path')?.trim() ?? '';
    if (!isSafePath(path) || (!access.isOwner && !path.startsWith(`${access.user.id}/`))) {
      return createApiErrorResponse(403, 'developer_cockpit_request_invalid', 'Campaign image access denied.');
    }
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return createApiErrorResponse(503, 'developer_cockpit_unavailable', 'Campaign media storage is not configured.');
    }
    const { data, error } = await supabase.storage.from(SOCIAL_SOURCE_BUCKET).download(path);
    if (error || !data) {
      return createApiErrorResponse(404, 'developer_cockpit_request_invalid', 'Campaign image not found.');
    }
    return new Response(data, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': data.type || 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to load campaign media.');
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const rateLimit = await consumeRateLimit({
      action: 'developer-campaign-media',
      identity: access.user.id,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many campaign image uploads. Please try again later.');
    }
    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) {
      return createApiErrorResponse(400, 'developer_cockpit_request_invalid', 'Choose a campaign image.');
    }
    const validation = validateSocialMediaFile(file);
    if (!validation.ok) {
      return createApiErrorResponse(
        file.size > MAX_SOCIAL_MEDIA_BYTES ? 413 : 400,
        file.size > MAX_SOCIAL_MEDIA_BYTES ? 'payload_too_large' : 'developer_cockpit_request_invalid',
        validation.message,
      );
    }
    const processed = await processSocialMediaImage(Buffer.from(await file.arrayBuffer()));
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return createApiErrorResponse(503, 'developer_cockpit_unavailable', 'Campaign media storage is not configured.');
    }
    const storagePath = `${access.user.id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.webp`;
    const { error } = await supabase.storage.from(SOCIAL_SOURCE_BUCKET).upload(
      storagePath,
      processed.buffer,
      {
        contentType: 'image/webp',
        upsert: false,
      },
    );
    if (error) {
      console.error('Failed to upload protected campaign media:', error);
      return createApiErrorResponse(500, 'developer_cockpit_unavailable', 'Unable to upload campaign media.');
    }
    return createNoStoreJsonResponse({
      media: {
        sourceBucket: SOCIAL_SOURCE_BUCKET,
        sourcePath: storagePath,
        publicUrl: null,
        previewUrl: `/api/developer-cockpit/media?path=${encodeURIComponent(storagePath)}`,
        width: processed.width,
        height: processed.height,
      },
    }, { status: 201 });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to upload campaign media.');
  }
}
