import type { CardData } from '@/domain/cards';
import type { FreeformCardElement } from '@/domain/templates';
import { getImageFieldKeyForElement, replacePlaceholdersLocal } from './textBindings';

export const isRenderableImageSource = (value?: string): value is string =>
  !!value && (
    value.startsWith('http')
    || value.startsWith('data:')
    || value.startsWith('blob:')
    || value.startsWith('cardforge-browser-asset://')
    || value.startsWith('/')
  );

export const resolveFreeformImageUrl = (
  element: FreeformCardElement,
  data: CardData,
  _fallbackText = 'Artwork'
): string => {
  if (element.imageSource === '__cardforge_deleted_media_blank__') return '';
  const imageFieldKey = getImageFieldKeyForElement(element);
  const keyedFieldValue = data[imageFieldKey];
  if (typeof keyedFieldValue === 'string' && isRenderableImageSource(keyedFieldValue)) {
    return keyedFieldValue;
  }

  const source = replacePlaceholdersLocal(element.imageSource || element.content, data, false);
  if (isRenderableImageSource(source)) return source;

  const keyedValue = source ? data[source] : undefined;
  if (typeof keyedValue === 'string' && isRenderableImageSource(keyedValue)) return keyedValue;

  return '';
};
