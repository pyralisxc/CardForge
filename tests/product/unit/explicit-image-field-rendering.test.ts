import { describe, expect, it } from 'vitest';

import type { CardData } from '@/domain/cards';
import { reconstructMinimalTemplateObject, type FreeformCardElement } from '@/domain/templates';
import {
  buildImageFieldOverrideDataKey,
  getCardFaceCanvas,
  getImageFieldKeyForElement,
  resolveImageElementOverrides,
  type DisplayCard,
} from '@/domain/rendering';
import { resolveFreeformImageUrl } from '@/features/card-rendering/model/elementStyles';

const fallbackArtwork = 'https://example.test/fallback.webp';
const cardArtwork = 'https://example.test/card-specific.webp';

const artworkElement: FreeformCardElement = {
  id: 'artwork',
  type: 'image',
  name: 'Artwork — Bottom Layer',
  x: 72,
  y: 66,
  width: 612,
  height: 570,
  zIndex: 0,
  locked: true,
  content: fallbackArtwork,
  imageSource: fallbackArtwork,
  imageObjectFit: 'cover',
};

const frameElement: FreeformCardElement = {
  id: 'frame-overlay',
  type: 'image',
  name: 'Frame Overlay',
  x: 0,
  y: 0,
  width: 750,
  height: 1050,
  zIndex: 1,
  locked: true,
  content: 'https://example.test/frame.webp',
  imageSource: 'https://example.test/frame.webp',
};

const template = reconstructMinimalTemplateObject({
  id: 'agent-template',
  name: 'Agent Template',
  aspectRatio: '750:1050',
  fieldContracts: [{
    key: 'artwork',
    type: 'image',
    label: 'Artwork',
    elementId: 'artwork',
    required: false,
    description: 'Optional per-card artwork override with a fixed Template fallback.',
  }],
  freeformCanvas: {
    width: 750,
    height: 1050,
    gridSize: 15,
    elements: [artworkElement, frameElement],
  },
});

const displayCard = (data: CardData): DisplayCard => ({
  uniqueId: 'card-1',
  template,
  backingTemplate: null,
  backingTemplateId: null,
  data,
});

describe('explicit image field rendering contracts', () => {
  it('renders card-specific artwork when an explicit image contract targets a fixed-source image element', () => {
    const card = displayCard({ artwork: cardArtwork });
    const canvas = getCardFaceCanvas(card, 'front');
    const artwork = canvas?.elements.find((element) => element.id === 'artwork');

    expect(artwork?.imageSource).toContain('{{artwork:');
    expect(artwork && getImageFieldKeyForElement(artwork)).toBe('artwork');
    expect(artwork && resolveFreeformImageUrl(artwork, card.data)).toBe(cardArtwork);
  });

  it('preserves the fixed Template artwork when the card has no per-card override', () => {
    const card = displayCard({});
    const canvas = getCardFaceCanvas(card, 'front');
    const artwork = canvas?.elements.find((element) => element.id === 'artwork');

    expect(artwork?.imageSource).toBe(fallbackArtwork);
    expect(artwork && resolveFreeformImageUrl(artwork, card.data)).toBe(fallbackArtwork);
  });

  it('uses the explicit contract key for image crop and placement overrides even when the fallback image is fixed', () => {
    const data: CardData = {
      artwork: cardArtwork,
      [buildImageFieldOverrideDataKey('artwork', 'fit')]: 'contain',
      [buildImageFieldOverrideDataKey('artwork', 'positionX')]: '35%',
    };
    const card = displayCard(data);
    const canvas = getCardFaceCanvas(card, 'front');
    const artwork = canvas?.elements.find((element) => element.id === 'artwork');

    expect(artwork).toBeDefined();
    const fieldKey = artwork ? getImageFieldKeyForElement(artwork) : undefined;
    expect(fieldKey).toBe('artwork');
    const resolved = artwork ? resolveImageElementOverrides(artwork, data, fieldKey) : null;
    expect(resolved?.imageStyle.objectFit).toBe('contain');
    expect(resolved?.imageStyle.objectPosition).toBe('35% center');
  });

  it('does not turn an unrelated locked frame layer into card data', () => {
    const card = displayCard({ artwork: cardArtwork });
    const canvas = getCardFaceCanvas(card, 'front');
    const frame = canvas?.elements.find((element) => element.id === 'frame-overlay');

    expect(frame?.imageSource).toBe('https://example.test/frame.webp');
    expect(frame && resolveFreeformImageUrl(frame, card.data)).toBe('https://example.test/frame.webp');
  });
});
