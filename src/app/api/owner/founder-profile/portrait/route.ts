import { revalidatePath } from 'next/cache';

import { getOwnerConsolePayload, getCurrentOwnerAccess } from '@/features/owner/server';
import {
  FOUNDER_PORTRAIT_BUCKET,
  FOUNDER_PORTRAIT_PATH,
  getFounderPortraitPublicUrl,
  getFounderProfile,
  processFounderPortrait,
  revalidateFounderProfile,
  updateFounderProfile,
  validateFounderPortraitFile,
} from '@/features/public-site/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to upload a portrait.');
    }

    const rateLimit = await consumeRateLimit({
      action: 'founder-portrait-upload',
      identity: owner.userId,
      limit: 12,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many portrait uploads. Please try again later.');
    }

    const formData = await request.formData();
    const portrait = formData.get('portrait');
    if (!(portrait instanceof File)) {
      return createApiErrorResponse(400, 'portrait_invalid', 'Choose a portrait to upload.');
    }
    const validation = validateFounderPortraitFile(portrait);
    if (!validation.ok) {
      return createApiErrorResponse(
        portrait.size > 8 * 1024 * 1024 ? 413 : 400,
        'portrait_invalid',
        validation.message,
      );
    }

    const processed = await processFounderPortrait(Buffer.from(await portrait.arrayBuffer()));
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return createApiErrorResponse(503, 'portrait_unavailable', 'Founder portrait storage is not configured yet.');
    }

    const { error: uploadError } = await supabase.storage
      .from(FOUNDER_PORTRAIT_BUCKET)
      .upload(FOUNDER_PORTRAIT_PATH, processed, {
        cacheControl: '3600',
        contentType: 'image/webp',
        upsert: true,
      });
    if (uploadError) {
      console.error('Failed to upload founder portrait:', uploadError);
      return createApiErrorResponse(500, 'portrait_unavailable', 'Unable to upload the founder portrait.');
    }

    const current = await getFounderProfile();
    const { updatedAt: _updatedAt, ...currentInput } = current;
    await updateFounderProfile({
      ...currentInput,
      portraitStoragePath: FOUNDER_PORTRAIT_PATH,
    });
    revalidateFounderProfile();
    revalidatePath('/cameron');
    revalidatePath('/', 'layout');

    return createNoStoreJsonResponse({
      console: await getOwnerConsolePayload(),
      portraitUrl: getFounderPortraitPublicUrl(FOUNDER_PORTRAIT_PATH),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'portrait_unavailable', error.message);
    }
    const message = error instanceof Error && error.message.includes('valid image')
      ? error.message
      : 'Unable to upload the founder portrait.';
    console.error('Failed to process founder portrait:', error);
    return createApiErrorResponse(400, 'portrait_invalid', message);
  }
}
