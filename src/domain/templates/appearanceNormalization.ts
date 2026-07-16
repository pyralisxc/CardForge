import type { FreeformAppearance, FreeformCardElement, TCGCardTemplate } from './types';

const borderClassToPixels = (value?: unknown): number => {
  if (!value || value === '_none_') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  if (typeof value !== 'string') return 0;
  if (value === 'border') return 1;
  const match = value.match(/border-(\d+)/);
  return match ? Number(match[1]) : 1;
};

const radiusClassToPixels = (value?: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  if (typeof value !== 'string') return 0;
  if (value === 'rounded-sm') return 2;
  if (value === 'rounded-md') return 6;
  if (value === 'rounded-lg') return 8;
  if (value === 'rounded-xl') return 12;
  if (value === 'rounded-full') return 999;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeAppearanceForElement = (element: Partial<FreeformCardElement>): FreeformAppearance => {
  if (element.appearance) return element.appearance;
  const baseColor = element.backgroundColor || element.fillColor || (element.type === 'text' ? 'transparent' : undefined);
  const rawBackground = typeof element.backgroundImageUrl === 'string' ? element.backgroundImageUrl : undefined;
  const borderWidth = borderClassToPixels(element.borderWidth);
  return {
    material: {
      baseColor,
      textColor: element.textColor,
      fillColor: element.fillColor,
      strokeColor: element.strokeColor,
      gradient: undefined,
      texture: rawBackground ? { kind: 'parchment', intensity: 25, scale: 10 } : { kind: 'none' },
    },
    border: {
      kind: borderWidth > 0 || Boolean(element.strokeWidth) ? 'solid' : 'none',
      color: element.borderColor || element.strokeColor,
      width: borderWidth || element.strokeWidth || 0,
      radius: radiusClassToPixels(element.borderRadius),
    },
    effects: { shadow: 0, glow: 0, bevel: 0, innerHighlight: 0, overlayOpacity: 100 },
    rawCss: rawBackground && !rawBackground.includes('gradient') ? { backgroundImage: rawBackground } : undefined,
  };
};

export const normalizeTemplateAppearance = (template: Partial<TCGCardTemplate>): FreeformAppearance => {
  if (template.appearance) return template.appearance;
  return {
    material: {
      baseColor: template.baseBackgroundColor,
      textColor: template.baseTextColor,
      texture: template.cardBackgroundImageUrl ? { kind: 'uploaded', imageSource: template.cardBackgroundImageUrl, intensity: 100 } : { kind: 'none' },
    },
    border: {
      kind: template.cardBorderStyle === 'double' ? 'double' : template.cardBorderWidth === '0px' ? 'none' : 'solid',
      color: template.cardBorderColor,
      width: parseInt(template.cardBorderWidth || '0', 10) || 0,
      radius: parseInt(template.cardBorderRadius || '0', 10) || 0,
    },
    rawCss: template.cardBorderImageSource ? { borderImageSource: template.cardBorderImageSource } : undefined,
  };
};
