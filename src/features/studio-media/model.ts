import type { CardAssetOption } from '@/domain/templates';

export const STUDIO_MEDIA_KINDS = ['image', 'texture', 'divider', 'icon'] as const;
export type StudioMediaKind = typeof STUDIO_MEDIA_KINDS[number];

export const STUDIO_MEDIA_CREATION_SOURCES = ['studio', 'gpt'] as const;
export type StudioMediaCreationSource = typeof STUDIO_MEDIA_CREATION_SOURCES[number];

export interface StudioMedia {
  id: string;
  name: string;
  kind: StudioMediaKind;
  creationSource: StudioMediaCreationSource;
  originalFilename: string;
  originalMimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  originalByteCount: number;
  normalizedMimeType: 'image/webp';
  normalizedByteCount: number;
  width: number;
  height: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export const studioMediaContentPath = (mediaId: string): string => (
  `/api/studio-media/${encodeURIComponent(mediaId)}/content`
);

export const studioMediaToCardAsset = (media: StudioMedia): CardAssetOption => {
  const shared = {
    id: `personal-${media.id}`,
    name: media.name,
    url: studioMediaContentPath(media.id),
    kind: media.kind,
    librarySource: 'personal' as const,
    fileSizeBytes: media.normalizedByteCount,
    seamless: media.kind === 'texture',
    defaultBlendMode: media.kind === 'texture' ? 'multiply' : 'normal',
    defaultOpacity: media.kind === 'texture' ? 45 : 100,
    defaultScale: media.kind === 'texture' ? 160 : 100,
  };

  if (media.kind === 'texture') {
    return {
      ...shared,
      kind: 'texture',
      tileMode: 'repeat',
      allowedTargets: ['text', 'shape', 'template'],
    };
  }
  if (media.kind === 'divider') {
    return {
      ...shared,
      kind: 'divider',
      tileMode: 'stretch',
      allowedTargets: ['divider'],
      defaultWidth: media.width,
      defaultHeight: media.height,
    };
  }
  if (media.kind === 'icon') {
    return {
      ...shared,
      kind: 'icon',
      tileMode: 'contain',
      allowedTargets: ['icon'],
      defaultWidth: Math.min(media.width, 128),
      defaultHeight: Math.min(media.height, 128),
    };
  }
  return {
    ...shared,
    kind: 'image',
    tileMode: 'contain',
    allowedTargets: ['image', 'imageFrame', 'template'],
    defaultWidth: media.width,
    defaultHeight: media.height,
  };
};
