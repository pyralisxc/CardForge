import type { CardData, CardFace } from '@/domain/cards';
import type { FreeformCanvas, TCGCardTemplate } from '@/domain/templates';
import { buildTextBinding, getBoundImageFieldKey } from './textBindings';
import type { DisplayCard } from './types';

const IMAGE_FIELD_OVERRIDE_DATA_PREFIX = '__cardforgeImageField.';

const hasImageFieldInput = (data: CardData, fieldKey: string): boolean => {
  const value = data[fieldKey];
  if (value !== undefined && value !== null && String(value).trim() !== '') return true;
  const overridePrefix = `${IMAGE_FIELD_OVERRIDE_DATA_PREFIX}${fieldKey}.`;
  return Object.keys(data).some((key) => key.startsWith(overridePrefix));
};

const materializeExplicitImageFieldBindings = (
  template: TCGCardTemplate,
  data: CardData,
): FreeformCanvas | undefined => {
  const canvas = template.freeformCanvas;
  if (!canvas || !template.fieldContracts?.length) return canvas;

  const imageContractByElementId = new Map(
    template.fieldContracts
      .filter((contract) => contract.type === 'image' && contract.elementId && contract.key)
      .map((contract) => [contract.elementId!, contract] as const),
  );
  if (imageContractByElementId.size === 0) return canvas;

  let changed = false;
  const elements = canvas.elements.map((element) => {
    if (element.type !== 'image') return element;
    const contract = imageContractByElementId.get(element.id);
    if (!contract || !hasImageFieldInput(data, contract.key)) return element;
    if (getBoundImageFieldKey(element) === contract.key) return element;

    const fallback = contract.defaultValue ?? element.imageSource ?? element.content ?? '';
    changed = true;
    return {
      ...element,
      imageSource: buildTextBinding(contract.key, String(fallback)),
    };
  });

  return changed ? { ...canvas, elements } : canvas;
};

export const hasCardBacking = (card: DisplayCard): boolean => (
  Boolean(card.backingTemplate?.freeformCanvas)
);

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
    return card.backingData ?? card.backingTemplate.templatePreviewData ?? {};
  }
  return card.data;
};

export const getCardFaceCanvas = (
  card: DisplayCard,
  face: CardFace,
): FreeformCanvas | undefined => materializeExplicitImageFieldBindings(
  getCardFaceTemplate(card, face),
  getCardFaceData(card, face),
);
