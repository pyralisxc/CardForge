import {
  createStudioMedia,
  getCurrentStudioMediaAccount,
  listStudioMedia,
  studioMediaToCardAsset,
  StudioMediaError,
} from '@/features/studio-media/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const toErrorResponse = (error: unknown) => {
  if (error instanceof StudioMediaError) {
    const code = error.status === 401
      ? 'sign_in_required'
      : error.status === 404
        ? 'studio_media_not_found'
        : error.status >= 500
          ? 'studio_media_unavailable'
          : 'studio_media_invalid';
    return createApiErrorResponse(error.status, code, error.message);
  }
  if (error instanceof RateLimitUnavailableError) {
    return createApiErrorResponse(503, 'studio_media_unavailable', error.message);
  }
  console.error('Studio media API failed:', error);
  return createApiErrorResponse(500, 'studio_media_unavailable', 'Unable to use personal Studio media.');
};

export async function GET() {
  try {
    const account = await getCurrentStudioMediaAccount();
    const media = await listStudioMedia(account.ownerUserId);
    return createNoStoreJsonResponse({
      media,
      assets: media.map(studioMediaToCardAsset),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await getCurrentStudioMediaAccount();
    const rateLimit = await consumeRateLimit({
      action: 'studio-media-upload',
      identity: account.ownerUserId,
      limit: 60,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many Studio media uploads. Please try again later.');
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return createApiErrorResponse(400, 'studio_media_invalid', 'Choose a Studio image to upload.');
    }
    const rawKind = formData.get('kind');
    const kind = typeof rawKind === 'string' ? rawKind : 'image';
    const rawName = formData.get('name');
    const inferredName = file.name.replace(/\.[^.]+$/, '').trim() || 'Studio artwork';
    const name = typeof rawName === 'string' && rawName.trim() ? rawName : inferredName;
    const media = await createStudioMedia({
      ownerUserId: account.ownerUserId,
      name,
      kind,
      creationSource: 'studio',
      originalFilename: file.name,
      declaredMimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return createNoStoreJsonResponse({
      media,
      asset: studioMediaToCardAsset(media),
    }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
