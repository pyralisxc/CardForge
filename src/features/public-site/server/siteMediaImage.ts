import sharp from 'sharp';

import type { SiteMediaSlot } from '../model/siteMedia';

export const MAX_SITE_MEDIA_BYTES = 12 * 1024 * 1024;
export const SITE_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const validateSiteMediaFile = ({ size, type }: { size: number; type: string }) => {
  if (size <= 0 || size > MAX_SITE_MEDIA_BYTES) {
    return { ok: false as const, message: 'Choose an image that is 12 MB or smaller.' };
  }
  if (!SITE_MEDIA_MIME_TYPES.has(type)) {
    return { ok: false as const, message: 'Choose a JPEG, PNG, or WebP image.' };
  }
  return { ok: true as const };
};

export interface ProcessedSiteMediaImage {
  buffer: Buffer;
  width: number;
  height: number;
}

export const processSiteMediaImage = async (
  source: Buffer,
  slot: SiteMediaSlot,
): Promise<ProcessedSiteMediaImage> => {
  try {
    const isScreenshot = slot.startsWith('landing.showcase.');
    const isPortrait = slot === 'founder.portrait';
    const isFavicon = slot === 'brand.favicon';
    const isSocialImage = slot === 'brand.social';
    const isBrandRaster = slot === 'brand.mark' || isFavicon || slot === 'brand.watermark';
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    await pipeline.metadata();
    const resized = pipeline.resize(isFavicon ? {
      width: 512,
      height: 512,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    } : isSocialImage ? {
      width: 1600,
      height: 900,
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    } : {
      width: isScreenshot || isPortrait ? 1600 : isBrandRaster ? 1800 : 2400,
      height: isScreenshot || isPortrait ? (isPortrait ? 2000 : 2400) : isBrandRaster ? 1800 : 1600,
      fit: 'inside',
      withoutEnlargement: true,
    });
    const { data, info } = await (isBrandRaster
      ? resized.png({ compressionLevel: 9 })
      : resized.webp({ quality: 90 }))
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    throw new Error('Upload a valid image file.');
  }
};
