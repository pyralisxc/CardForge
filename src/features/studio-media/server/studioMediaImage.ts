import sharp from 'sharp';

import { StudioMediaError } from './StudioMediaError';

export const MAX_STUDIO_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_STUDIO_MEDIA_DIMENSION = 8192;
export const NORMALIZED_STUDIO_MEDIA_DIMENSION = 2400;
export const STUDIO_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MIME_TYPE_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

export type StudioMediaOriginalMimeType = typeof MIME_TYPE_BY_FORMAT[keyof typeof MIME_TYPE_BY_FORMAT];

export const validateStudioMediaSource = ({
  byteCount,
  declaredMimeType,
}: {
  byteCount: number;
  declaredMimeType?: string;
}) => {
  if (byteCount <= 0 || byteCount > MAX_STUDIO_MEDIA_BYTES) {
    throw new StudioMediaError('Studio artwork must be 8 MB or smaller.', 413);
  }
  if (declaredMimeType && !STUDIO_MEDIA_MIME_TYPES.has(declaredMimeType.toLowerCase())) {
    throw new StudioMediaError('Upload JPEG, PNG, or WebP artwork.', 400);
  }
};

export interface ProcessedStudioMediaImage {
  buffer: Buffer;
  width: number;
  height: number;
  originalMimeType: StudioMediaOriginalMimeType;
}

export const processStudioMediaImage = async (
  source: Buffer,
): Promise<ProcessedStudioMediaImage> => {
  validateStudioMediaSource({ byteCount: source.byteLength });
  try {
    const sourceImage = sharp(source, {
      failOn: 'error',
      limitInputPixels: MAX_STUDIO_MEDIA_DIMENSION * MAX_STUDIO_MEDIA_DIMENSION,
    });
    const metadata = await sourceImage.metadata();
    const originalMimeType = metadata.format
      ? MIME_TYPE_BY_FORMAT[metadata.format as keyof typeof MIME_TYPE_BY_FORMAT]
      : undefined;
    if (!originalMimeType) {
      throw new StudioMediaError('Upload JPEG, PNG, or WebP artwork.', 400);
    }
    if (
      !metadata.width
      || !metadata.height
      || metadata.width > MAX_STUDIO_MEDIA_DIMENSION
      || metadata.height > MAX_STUDIO_MEDIA_DIMENSION
    ) {
      throw new StudioMediaError(
        `Artwork dimensions must be ${MAX_STUDIO_MEDIA_DIMENSION}px or smaller.`,
        400,
      );
    }

    const { data, info } = await sharp(source, {
      failOn: 'error',
      limitInputPixels: MAX_STUDIO_MEDIA_DIMENSION * MAX_STUDIO_MEDIA_DIMENSION,
    })
      .rotate()
      .resize({
        width: NORMALIZED_STUDIO_MEDIA_DIMENSION,
        height: NORMALIZED_STUDIO_MEDIA_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      originalMimeType,
    };
  } catch (error) {
    if (error instanceof StudioMediaError) throw error;
    throw new StudioMediaError('Upload a valid JPEG, PNG, or WebP image.', 400);
  }
};
