import type { AppearanceGradient, FreeformAppearance, FreeformCardElement, TCGCardTemplate } from './types';

/** Decode only the simple opaque two-color legacy form, never approximate CSS. */
const legacyLinearGradient = (value?: string): AppearanceGradient | undefined => {
  const match = value?.trim().match(/^linear-gradient\(\s*([+-]?\d+(?:\.\d+)?)deg\s*,(.*)\)$/iu);
  if (!match || !Number.isFinite(Number(match[1]))) return undefined;
  const colors = match[2].split(',');
  if (colors.length !== 2) return undefined;
  const stops: AppearanceGradient['stops'] = [];
  for (let index = 0; index < colors.length; index++) {
    const color = colors[index].trim().match(/^(#[\da-f]{3}(?:[\da-f]{3})?)(?:\s+(0|\d+(?:\.\d+)?%))?(?:\s+(0|\d+(?:\.\d+)?%))?$/iu);
    if (!color) return undefined;
    const positions = color[2] === undefined ? [index === 0 ? 0 : 100]
      : [color[2], color[3]].filter((position) => position !== undefined).map((position) => Number(position!.replace('%', '')));
    for (const position of positions) {
      if (!Number.isFinite(position) || position < 0 || position > 100 || position < (stops.at(-1)?.position ?? 0)) return undefined;
      stops.push({ id: `legacy-gradient-${stops.length}`, color: color[1], position, opacity: 1 });
    }
  }
  return { type: 'linear', angle: Number(match[1]), stops };
};

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
  const gradient = legacyLinearGradient(rawBackground);
  const borderWidth = borderClassToPixels(element.borderWidth);
  const shapeStrokeWidth = element.type === 'shape' && typeof element.strokeWidth === 'number'
    ? element.strokeWidth
    : 0;
  return {
    material: {
      baseColor,
      textColor: element.textColor,
      fillColor: element.fillColor,
      strokeColor: element.strokeColor,
      gradient,
      texture: rawBackground && !gradient ? { kind: 'parchment', intensity: 25, scale: 10 } : { kind: 'none' },
    },
    border: {
      kind: borderWidth > 0 || shapeStrokeWidth > 0 ? 'solid' : 'none',
      color: element.borderColor || element.strokeColor,
      width: borderWidth || shapeStrokeWidth,
      radius: radiusClassToPixels(element.borderRadius),
    },
    effects: { shadow: 0, glow: 0, bevel: 0, innerHighlight: 0, overlayOpacity: 100 },
    rawCss: rawBackground && !gradient && !rawBackground.includes('gradient') ? { backgroundImage: rawBackground } : undefined,
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
