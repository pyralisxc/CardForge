import type { CSSProperties } from 'react';
import type { AppearanceBorder, AppearanceEffects, AppearanceGradient, AppearanceTexture, FreeformAppearance, FreeformCardElement } from '@/domain/templates';

export const gradientToCss = (gradient?: AppearanceGradient): string | undefined => {
  if (!gradient || gradient.type === 'none' || gradient.stops.length === 0) return undefined;
  const stops = gradient.stops
    .map(stop => {
      const color = stop.opacity === undefined ? stop.color : colorWithOpacity(stop.color, stop.opacity);
      return `${color} ${Math.max(0, Math.min(100, stop.position))}%`;
    })
    .join(', ');
  if (gradient.type === 'radial') return `radial-gradient(circle at 50% 0%, ${stops})`;
  return `linear-gradient(${gradient.angle ?? 135}deg, ${stops})`;
};

export const textureToCss = (texture?: AppearanceTexture): string | undefined => {
  if (!texture || texture.kind === 'none') return undefined;
  const intensity = Math.max(0, Math.min(100, texture.intensity ?? 35)) / 100;
  const scale = Math.max(2, texture.scale ?? 10);
  if (texture.assetSource) return `url(${texture.assetSource})`;
  if (texture.kind === 'uploaded' && texture.imageSource) return `url(${texture.imageSource})`;
  if (texture.kind === 'parchment') {
    return `radial-gradient(circle at 15% 20%, rgba(80,42,13,${0.22 * intensity}), transparent 18%), repeating-linear-gradient(0deg, rgba(80,42,13,${0.08 * intensity}) 0 1px, transparent 1px ${scale}px)`;
  }
  if (texture.kind === 'foil') {
    return `repeating-linear-gradient(115deg, rgba(255,255,255,${0.2 * intensity}) 0 3px, transparent 3px ${scale}px)`;
  }
  if (texture.kind === 'etched') {
    return `repeating-linear-gradient(135deg, rgba(255,255,255,${0.13 * intensity}) 0 2px, transparent 2px ${scale}px)`;
  }
  if (texture.kind === 'hatch') {
    return `repeating-linear-gradient(90deg, rgba(255,255,255,${0.12 * intensity}) 0 1px, transparent 1px ${scale}px)`;
  }
  return `radial-gradient(circle, rgba(255,255,255,${0.12 * intensity}) 0 1px, transparent 1px ${scale}px)`;
};

export const appearanceToStyle = (appearance?: FreeformAppearance): CSSProperties => {
  if (!appearance) return {};
  const material = appearance.material;
  const border = appearance.border;
  const effects = appearance.effects;
  const texture = textureToCss(material?.texture);
  const gradient = gradientToCss(material?.gradient);
  const assetSource = appearance.dividerAsset || appearance.assetSource;
  const asset = assetSource ? `url(${assetSource})` : undefined;
  const backgroundImage = [asset, texture, gradient, appearance.rawCss?.backgroundImage].filter(Boolean).join(', ') || undefined;
  const textureScale = material?.texture?.textureScale ?? appearance.textureScale;
  const blendMode = material?.texture?.blendMode ?? appearance.blendMode;
  const tileMode = appearance.tileMode ?? material?.texture?.tileMode;
  const assetBackgroundSize = tileMode === 'contain' ? 'contain' : tileMode === 'repeat' ? `${textureScale || 160}px ${textureScale || 160}px` : '100% 100%';
  const textureBackgroundSize = textureScale ? `${textureScale}px ${textureScale}px` : texture?.startsWith('url(') ? '160px 160px' : undefined;
  const borderStyle = borderToStyle(border);
  const boxShadow = [borderStyle.boxShadow, effectsToBoxShadow(effects, border)]
    .filter(Boolean)
    .join(', ') || undefined;
  return {
    color: material?.textColor,
    backgroundColor: material?.baseColor || material?.fillColor,
    backgroundImage,
    backgroundSize: asset ? assetBackgroundSize : textureBackgroundSize,
    backgroundRepeat: asset ? (tileMode === 'repeat' ? 'repeat' : 'no-repeat') : texture?.startsWith('url(') ? 'repeat' : undefined,
    backgroundPosition: asset && tileMode === 'contain' ? 'center' : undefined,
    backgroundBlendMode: blendMode,
    ...borderStyle,
    boxShadow,
  };
};

export const appearanceToElementRenderFields = (element: FreeformCardElement): Partial<FreeformCardElement> => {
  const style = appearanceToStyle(element.appearance);
  const borderWidth = element.appearance?.border?.width;
  const borderColor = element.appearance?.border?.color;
  const borderIsEnabled = element.appearance?.border && element.appearance.border.kind !== 'none';
  const borderDrivesStroke = element.type === 'shape';
  return {
    backgroundColor: typeof style.backgroundColor === 'string' ? style.backgroundColor : element.backgroundColor,
    backgroundImageUrl: typeof style.backgroundImage === 'string' ? style.backgroundImage : element.backgroundImageUrl,
    textColor: element.appearance?.material?.textColor || element.textColor,
    fillColor: element.appearance?.material?.fillColor || element.appearance?.material?.baseColor || element.fillColor,
    strokeColor: element.appearance?.material?.strokeColor || (borderDrivesStroke && borderIsEnabled ? borderColor : undefined) || element.strokeColor,
    borderColor: borderColor || element.borderColor,
    borderRadius: element.appearance?.border?.radius !== undefined ? radiusToClass(element.appearance.border.radius) : element.borderRadius,
    borderWidth: borderWidth !== undefined ? pixelsToBorderClass(borderWidth) : element.borderWidth,
    strokeWidth: borderDrivesStroke && borderWidth !== undefined ? borderWidth : element.strokeWidth,
  };
};

const colorWithOpacity = (color: string, opacity: number): string => {
  if (color === 'transparent') return color;
  const clamped = Math.max(0, Math.min(1, opacity));
  if (!color.startsWith('#') || (color.length !== 7 && color.length !== 4)) return color;
  const full = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${clamped})`;
};

const effectsToBoxShadow = (effects?: AppearanceEffects, border?: AppearanceBorder): string | undefined => {
  const shadows: string[] = [];
  if (effects?.shadow) shadows.push(`0 ${Math.round(effects.shadow / 4)}px ${effects.shadow}px rgba(0,0,0,0.35)`);
  if (effects?.glow) shadows.push(`0 0 ${effects.glow}px ${border?.secondaryColor || border?.color || 'rgba(213,173,84,0.45)'}`);
  if (effects?.innerHighlight) shadows.push(`inset 0 1px ${Math.max(2, Math.round(effects.innerHighlight / 4))}px rgba(255,255,255,0.24)`);
  if (effects?.bevel) shadows.push(`inset 0 -${Math.max(1, Math.round(effects.bevel / 8))}px ${Math.max(2, Math.round(effects.bevel / 3))}px rgba(0,0,0,0.28)`);
  return shadows.length ? shadows.join(', ') : undefined;
};

const borderToStyle = (border?: AppearanceBorder): CSSProperties => {
  if (!border) return {};

  const radius = border.radius !== undefined ? `${border.radius}px` : undefined;
  if (border.kind === 'none') {
    return {
      borderWidth: 0,
      borderStyle: 'none',
      borderRadius: radius,
      borderImageSource: undefined,
    };
  }

  const color = border.color || '#d5ad54';
  const secondaryColor = border.secondaryColor || color;
  const width = Math.max(1, border.width ?? 1);
  const innerWidth = Math.max(1, border.innerWidth ?? 1);
  const base: CSSProperties = {
    borderColor: color,
    borderWidth: width,
    borderStyle: border.kind === 'double' ? 'double' : 'solid',
    borderRadius: radius,
    borderImageSource: undefined,
  };

  if (border.kind === 'etched') {
    return {
      ...base,
      boxShadow: [
        `inset 0 0 0 ${innerWidth}px ${secondaryColor}`,
        'inset 0 1px 2px rgba(255,255,255,0.22)',
        'inset 0 -2px 3px rgba(0,0,0,0.36)',
      ].join(', '),
    };
  }

  if (border.kind === 'relic') {
    return {
      ...base,
      boxShadow: [
        `inset 0 0 0 ${innerWidth}px ${secondaryColor}`,
        'inset 0 2px 8px rgba(255,255,255,0.16)',
        'inset 0 -4px 10px rgba(0,0,0,0.38)',
        `0 0 ${width + 4}px ${colorWithOpacity(secondaryColor, 0.28)}`,
      ].join(', '),
    };
  }

  if (border.kind === 'foil') {
    return {
      ...base,
      borderImageSource: `linear-gradient(135deg, ${secondaryColor}, ${color}, ${colorWithOpacity(secondaryColor, 0.45)}, ${color})`,
      borderImageSlice: 1,
      boxShadow: [
        `0 0 ${width + 8}px ${colorWithOpacity(secondaryColor, 0.34)}`,
        'inset 0 1px 4px rgba(255,255,255,0.24)',
      ].join(', '),
    };
  }

  return base;
};

const pixelsToBorderClass = (value: number): string => {
  if (value <= 0) return '_none_';
  if (value === 1) return 'border';
  return `border-${Math.min(8, Math.max(0, Math.round(value)))}`;
};

const radiusToClass = (value: number): string => {
  if (value >= 100) return 'rounded-full';
  if (value >= 12) return 'rounded-xl';
  if (value >= 8) return 'rounded-lg';
  if (value >= 6) return 'rounded-md';
  if (value >= 2) return 'rounded-sm';
  return 'rounded-none';
};
