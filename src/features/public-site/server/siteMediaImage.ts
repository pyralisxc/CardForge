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
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    await pipeline.metadata();
    const { data, info } = await pipeline
      .resize({
        width: isScreenshot || isPortrait ? 1600 : 2400,
        height: isScreenshot || isPortrait ? (isPortrait ? 2000 : 2400) : 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    throw new Error('Upload a valid image file.');
  }
};
