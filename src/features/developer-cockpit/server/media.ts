import sharp from 'sharp';

export const SOCIAL_SOURCE_BUCKET = 'cardforge-social-sources';
export const SOCIAL_PUBLIC_MEDIA_BUCKET = 'cardforge-social-media';
export const MAX_SOCIAL_MEDIA_BYTES = 12 * 1024 * 1024;
export const SOCIAL_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const validateSocialMediaFile = ({ size, type }: { size: number; type: string }) => {
  if (size <= 0 || size > MAX_SOCIAL_MEDIA_BYTES) {
    return { ok: false as const, message: 'Choose a campaign image that is 12 MB or smaller.' };
  }
  if (!SOCIAL_MEDIA_MIME_TYPES.has(type)) {
    return { ok: false as const, message: 'Choose a JPEG, PNG, or WebP campaign image.' };
  }
  return { ok: true as const };
};

export const processSocialMediaImage = async (
  source: Buffer,
): Promise<{ buffer: Buffer; width: number; height: number }> => {
  try {
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    await pipeline.metadata();
    const { data, info } = await pipeline
      .resize({
        width: 2400,
        height: 2400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    throw new Error('Upload a valid campaign image.');
  }
};
