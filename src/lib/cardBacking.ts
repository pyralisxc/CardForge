import type { CardData, CardFace, DisplayCard, FreeformCanvas, TCGCardTemplate } from '@/types';

export const hasCardBacking = (card: DisplayCard): boolean => (
  Boolean(card.backingTemplate?.freeformCanvas || card.template.backCanvas)
);

export const getCardFaceCanvas = (
  card: DisplayCard,
  face: CardFace,
): FreeformCanvas | undefined => {
  if (face === 'front') return card.template.freeformCanvas;
  return card.backingTemplate?.freeformCanvas || card.template.backCanvas || card.template.freeformCanvas;
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
