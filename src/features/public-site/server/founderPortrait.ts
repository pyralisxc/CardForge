import sharp from 'sharp';

export const MAX_FOUNDER_PORTRAIT_BYTES = 8 * 1024 * 1024;
export const FOUNDER_PORTRAIT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const validateFounderPortraitFile = ({ size, type }: { size: number; type: string }) => {
  if (size <= 0 || size > MAX_FOUNDER_PORTRAIT_BYTES) {
    return { ok: false as const, message: 'Choose an image that is 8 MB or smaller.' };
  }
  if (!FOUNDER_PORTRAIT_MIME_TYPES.has(type)) {
    return { ok: false as const, message: 'Choose a JPEG, PNG, or WebP image.' };
  }
  return { ok: true as const };
};

export const processFounderPortrait = async (source: Buffer): Promise<Buffer> => {
  try {
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    await pipeline.metadata();
    return await pipeline
      .resize({
        width: 1600,
        height: 2000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer();
  } catch {
    throw new Error('Upload a valid image file.');
  }
};
