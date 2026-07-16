import type { CardData, CardFace } from '@/domain/cards';
import type { FreeformCanvas, TCGCardTemplate } from '@/domain/templates';
import type { DisplayCard } from '@/domain/rendering';

export const hasCardBacking = (card: DisplayCard): boolean => (
  Boolean(card.backingTemplate?.freeformCanvas)
);

export const getCardFaceCanvas = (
  card: DisplayCard,
  face: CardFace,
): FreeformCanvas | undefined => {
  if (face === 'front') return card.template.freeformCanvas;
  return card.backingTemplate?.freeformCanvas;
};

export const getCardFaceTemplate = (
  card: DisplayCard,
  face: CardFace,
): TCGCardTemplate => {
  if (face === 'back' && card.backingTemplate) return card.backingTemplate;
  return card.template;
};

export const getCardFaceData = (
  card: DisplayCard,
  face: CardFace,
): CardData => {
  if (face === 'back' && card.backingTemplate) {
    return card.backingTemplate.templatePreviewData || {};
  }
  return card.data;
};
