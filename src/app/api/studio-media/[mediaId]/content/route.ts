import { z } from 'zod';

import {
  downloadStudioMedia,
  getCurrentStudioMediaAccount,
  StudioMediaError,
} from '@/features/studio-media/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const idSchema = z.string().uuid();

const readMediaId = async (context: { params: Promise<{ mediaId: string }> }) => {
  const parsed = idSchema.safeParse((await context.params).mediaId);
  return parsed.success ? parsed.data : null;
};

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
  console.error('Studio media content request failed:', error);
  return createApiErrorResponse(500, 'studio_media_unavailable', 'Unable to read personal Studio media.');
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ mediaId: string }> },
) {
  try {
    const mediaId = await readMediaId(context);
    if (!mediaId) {
      return createApiErrorResponse(400, 'studio_media_invalid', 'A valid Studio media id is required.');
    }
    const account = await getCurrentStudioMediaAccount();
    const { media, bytes } = await downloadStudioMedia(account.ownerUserId, mediaId);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=86400, immutable',
        'Content-Type': media.normalizedMimeType,
        'Content-Length': String(bytes.byteLength),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
