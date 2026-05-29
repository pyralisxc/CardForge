import type { CardData, FreeformCardElement } from '@/types';
import type { CSSProperties } from 'react';
import { getImageFieldKeyForElement, replacePlaceholdersLocal } from '@/lib/textBindings';

export const borderWidthClassToPixels = (value?: unknown): number => {
  if (!value || value === '_none_') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  if (typeof value !== 'string') return 0;
  if (value === 'border') return 1;
  if (value === 'border-t' || value === 'border-r' || value === 'border-b' || value === 'border-l') return 1;
  const match = value.match(/border-(\d+)/);
  return match ? Number(match[1]) : 1;
};

export const borderWidthClassToStyle = (value?: unknown): CSSProperties => {
  const width = borderWidthClassToPixels(value);
  if (width <= 0) return { borderWidth: 0 };
  if (value === 'border-t') return { borderTopWidth: width, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0 };
  if (value === 'border-r') return { borderTopWidth: 0, borderRightWidth: width, borderBottomWidth: 0, borderLeftWidth: 0 };
  if (value === 'border-b') return { borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: width, borderLeftWidth: 0 };
  if (value === 'border-l') return { borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: width };
  return { borderWidth: width };
};

export const radiusClassToCss = (value?: unknown): string | undefined => {
  if (typeof value === 'number') return `${Math.max(0, value)}px`;
  if (typeof value !== 'string') return undefined;
  switch (value) {
    case 'rounded-sm': return '2px';
    case 'rounded-md': return '6px';
    case 'rounded-lg': return '8px';
    case 'rounded-xl': return '12px';
    case 'rounded-full': return '9999px';
    default: return undefined;
  }
};

export const shapeClipPath = (shapeKind?: FreeformCardElement['shapeKind']): string | undefined => {
  if (shapeKind === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  if (shapeKind === 'hexagon') return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
  if (shapeKind === 'banner') return 'polygon(0% 0%, 92% 0%, 100% 50%, 92% 100%, 0% 100%, 8% 50%)';
  if (shapeKind === 'capsule') return undefined;
  if (shapeKind === 'notch-panel') return 'polygon(6% 0%, 94% 0%, 100% 14%, 100% 86%, 94% 100%, 6% 100%, 0% 86%, 0% 14%)';
  if (shapeKind === 'bracket-frame') return 'polygon(0% 0%, 18% 0%, 18% 8%, 8% 8%, 8% 92%, 18% 92%, 18% 100%, 0% 100%, 0% 0%, 82% 0%, 100% 0%, 100% 100%, 82% 100%, 82% 92%, 92% 92%, 92% 8%, 82% 8%)';
  if (shapeKind === 'corner-frame') return 'polygon(0% 0%, 28% 0%, 28% 6%, 6% 6%, 6% 28%, 0% 28%, 0% 0%, 72% 0%, 100% 0%, 100% 28%, 94% 28%, 94% 6%, 72% 6%, 72% 0%, 100% 72%, 100% 100%, 72% 100%, 72% 94%, 94% 94%, 94% 72%, 100% 72%, 28% 100%, 0% 100%, 0% 72%, 6% 72%, 6% 94%, 28% 94%)';
  return undefined;
};

const isRenderableImageSource = (value?: string): value is string =>
  !!value && (
    value.startsWith('http')
    || value.startsWith('data:')
    || value.startsWith('blob:')
    || value.startsWith('/')
  );

export const resolveFreeformImageUrl = (
  element: FreeformCardElement,
  data: CardData,
  fallbackText = 'Artwork'
): string => {
  const imageFieldKey = getImageFieldKeyForElement(element);
  const keyedFieldValue = data[imageFieldKey];
  if (typeof keyedFieldValue === 'string' && isRenderableImageSource(keyedFieldValue)) {
    return keyedFieldValue;
  }

  const source = replacePlaceholdersLocal(element.imageSource || element.content, data, false);
  if (isRenderableImageSource(source)) return source;

  const keyedValue = source ? data[source] : undefined;
  if (typeof keyedValue === 'string' && isRenderableImageSource(keyedValue)) return keyedValue;

  return `https://placehold.co/${Math.max(80, Math.round(element.width || 300))}x${Math.max(80, Math.round(element.height || 200))}.png?text=${encodeURIComponent(fallbackText || 'Image')}`;
};
