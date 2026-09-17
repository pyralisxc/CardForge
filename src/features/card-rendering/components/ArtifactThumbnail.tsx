"use client";

import { memo } from 'react';

import type { CardFace } from '@/domain/cards';
import {
  getCardFaceCanvas,
  getCardFaceData,
  getCardFaceTemplate,
  getImageFieldKeyForElement,
  replacePlaceholdersLocal,
  type DisplayCard,
} from '@/domain/rendering';
import { normalizeTemplateAppearance, type TCGCardTemplate } from '@/domain/templates';
import { useProjectBinaryAssetUrl, useProjectBinaryAssetValue } from '@/features/project/client/useProjectBinaryAssetUrl';

import { appearanceToStyle } from '../model/appearance';

const appearanceCache = new WeakMap<TCGCardTemplate, ReturnType<typeof appearanceToStyle>>();

const thumbnailAppearance = (template: TCGCardTemplate) => {
  const cached = appearanceCache.get(template);
  if (cached) return cached;
  const appearance = appearanceToStyle(normalizeTemplateAppearance(template));
  appearanceCache.set(template, appearance);
  return appearance;
};

const isImageSource = (value: unknown): value is string => typeof value === 'string' && (
  value.startsWith('http')
  || value.startsWith('data:')
  || value.startsWith('blob:')
  || value.startsWith('cardforge-browser-asset://')
  || value.startsWith('/')
);

const asBackgroundImage = (value: string | undefined) => {
  if (!value) return undefined;
  if (value.startsWith('linear-gradient') || value.startsWith('radial-gradient') || value.startsWith('url(')) return value;
  return isImageSource(value) ? `url(${value})` : undefined;
};

function ResolvedArtifactThumbnailImage({ card, face }: { card: DisplayCard; face: CardFace }) {
  const template = getCardFaceTemplate(card, face);
  const data = getCardFaceData(card, face);
  const canvas = getCardFaceCanvas(card, face);
  const appearance = thumbnailAppearance(template);
  const authoredBackground = template.cardBackgroundImageUrl
    ? replacePlaceholdersLocal(template.cardBackgroundImageUrl, data, false)
    : undefined;
  const backgroundImage = useProjectBinaryAssetValue([
    asBackgroundImage(authoredBackground),
    appearance.backgroundImage,
  ].filter(Boolean).join(', ') || undefined);
  const image = [...(canvas?.elements ?? [])]
    .filter((element) => element.visible !== false && element.type === 'image')
    .sort((left, right) => {
      const areaDifference = (right.width * right.height) - (left.width * left.height);
      return areaDifference || right.zIndex - left.zIndex;
    })[0];
  const boundValue = image ? data[getImageFieldKeyForElement(image)] : undefined;
  const authoredSource = image ? replacePlaceholdersLocal(image.imageSource || image.content, data, false) : undefined;
  const indirectValue = authoredSource ? data[authoredSource] : undefined;
  const heroSource = isImageSource(boundValue)
    ? boundValue
    : isImageSource(authoredSource)
      ? authoredSource
      : isImageSource(indirectValue)
        ? indirectValue
        : undefined;
  const heroUrl = useProjectBinaryAssetUrl(heroSource);

  return <span style={{ position: 'absolute', inset: 0, backgroundImage, backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundSize: 'cover' }}>
    {heroUrl ? <img src={heroUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} /> : null}
  </span>;
}

/**
 * Image-led overview fidelity for collections too large to mount the complete
 * card renderer. At microscopic Fit scale it keeps the authored surface; real
 * imagery resolves progressively once it has enough screen area to be useful.
 */
export const ArtifactThumbnail = memo(function ArtifactThumbnail({ card, face = 'front', width, height, showImage }: {
  card: DisplayCard;
  face?: CardFace;
  width: number;
  height: number;
  showImage: boolean;
}) {
  const template = getCardFaceTemplate(card, face);
  const appearance = thumbnailAppearance(template);
  const structuralBackground = appearance.backgroundImage?.startsWith('linear-gradient') || appearance.backgroundImage?.startsWith('radial-gradient')
    ? appearance.backgroundImage
    : undefined;

  return <span
    data-card-preview-detail="thumbnail"
    data-thumbnail-image={showImage ? 'visible' : 'deferred'}
    style={{
      position: 'relative',
      display: 'block',
      width,
      height,
      overflow: 'hidden',
      borderRadius: template.cardBorderRadius || undefined,
      backgroundColor: appearance.backgroundColor || template.baseBackgroundColor || 'var(--cf-surface-inset)',
      backgroundImage: structuralBackground,
      backgroundPosition: appearance.backgroundPosition,
      backgroundRepeat: appearance.backgroundRepeat,
      backgroundSize: appearance.backgroundSize,
    }}
  >
    {showImage ? <ResolvedArtifactThumbnailImage card={card} face={face} /> : null}
  </span>;
});
