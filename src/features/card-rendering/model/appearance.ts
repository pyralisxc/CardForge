import type { CSSProperties } from 'react';
import type { AppearanceBorder, AppearanceEffects, AppearanceGradient, AppearanceTexture, FreeformAppearance, FreeformCardElement, TCGCardTemplate } from '@/domain/templates';
import { isSvgAssetSource, svgSourceForStretch } from '@/domain/templates/vectorAssets';

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

/** Preserve authored fragments and non-URL/multi-layer CSS without reinterpretation. */
const stretchSvgBackground = (image?: string): string | undefined => {
  if (!image) return image;
  const match = /^url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)$/u.exec(image);
  const source = match?.[1] ?? match?.[2] ?? match?.[3]?.trim();
  if (!source) return image;
  const projected = svgSourceForStretch(source);
  return projected === source ? image : `url(${JSON.stringify(projected)})`;
};

export const splitBackgroundLayers = (image: string): string[] => {
  if (!image) return [];
  const layers: string[] = [];
  let start = 0, depth = 0, quote = '';
  for (let index = 0; index < image.length; index += 1) {
    const char = image[index];
    if (char === '\\') { index += 1; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) { layers.push(image.slice(start, index).trim()); start = index + 1; }
  }
  layers.push(image.slice(start).trim());
  return layers;
};
const backgroundLayerCount = (image: string) => splitBackgroundLayers(image).length;
type TextureLayerStyle = CSSProperties & { '--cf-texture-layer'?: number; '--cf-texture-strength'?: number };
export const textureLayerMetadata = (style?: CSSProperties) => {
  const data = style as TextureLayerStyle | undefined;
  return data?.['--cf-texture-layer'] === undefined ? undefined : {
    index: data['--cf-texture-layer'], opacity: data['--cf-texture-strength'] ?? 1,
  };
};
/** Render-only metadata follows the same background list; it never enters authored JSON. */
export const textureLayerStyle = (style?: CSSProperties, precedingLayers = 0): TextureLayerStyle => {
  const data = textureLayerMetadata(style);
  return data ? { '--cf-texture-layer': data.index + precedingLayers, '--cf-texture-strength': data.opacity } : {};
};

/** An explicit foundation fit owns only that image, not independent material layers. */
export const authoredCardFoundationStyle = (
  template: Pick<TCGCardTemplate, 'cardBackgroundImageFit'>,
  foundationImage: string | undefined,
  appearance: CSSProperties,
): CSSProperties | undefined => {
  if (!template.cardBackgroundImageFit || !foundationImage) return undefined;
  // Legacy normalization may project this same source as a texture as well.
  // Paint it once; otherwise transparency exposes a differently fitted duplicate.
  const fittedFoundationImage = template.cardBackgroundImageFit === 'fill' ? stretchSvgBackground(foundationImage) : foundationImage;
  const materialImage = appearance.backgroundImage === foundationImage || appearance.backgroundImage === stretchSvgBackground(foundationImage) ? undefined : appearance.backgroundImage;
  const materialProperty = (property: 'backgroundSize' | 'backgroundRepeat' | 'backgroundPosition', fallback: string) => (
    appearance[property] || Array.from({ length: backgroundLayerCount(String(materialImage)) }, () => fallback).join(', ')
  );
  return {
    ...(materialImage ? textureLayerStyle(appearance, 1) : { '--cf-texture-layer': undefined, '--cf-texture-strength': undefined }),
    backgroundImage: [fittedFoundationImage, materialImage].filter(Boolean).join(', '),
    backgroundSize: [template.cardBackgroundImageFit === 'fill' ? '100% 100%' : template.cardBackgroundImageFit,
      ...(materialImage ? [materialProperty('backgroundSize', 'auto')] : [])].join(', '),
    backgroundRepeat: ['no-repeat', ...(materialImage ? [materialProperty('backgroundRepeat', 'repeat')] : [])].join(', '),
    backgroundPosition: ['center', ...(materialImage ? [materialProperty('backgroundPosition', '0% 0%')] : [])].join(', '),
  };
};

export const appearanceToStyle = (appearance?: FreeformAppearance): CSSProperties => {
  if (!appearance) return {};
  const material = appearance.material;
  const border = appearance.border;
  const effects = appearance.effects;
  const rawTexture = textureToCss(material?.texture);
  const gradient = gradientToCss(material?.gradient);
  const assetSource = appearance.dividerAsset || appearance.assetSource;
  const rawAsset = assetSource ? `url(${assetSource})` : undefined;
  const tintVector = appearance.assetRenderMode === 'tint' && isSvgAssetSource(assetSource);
  const textureScale = material?.texture?.textureScale ?? appearance.textureScale;
  const blendMode = material?.texture?.blendMode ?? appearance.blendMode;
  const assetTileMode = appearance.tileMode ?? material?.texture?.tileMode;
  const textureTileMode = material?.texture?.tileMode ?? appearance.tileMode;
  const asset = assetTileMode === 'stretch' ? stretchSvgBackground(rawAsset) : rawAsset;
  const texture = textureTileMode === 'stretch' ? stretchSvgBackground(rawTexture) : rawTexture;
  const repeatedSize = `${textureScale || 160}px ${textureScale || 160}px`;
  const assetBackgroundSize = assetTileMode === 'contain' ? 'contain' : assetTileMode === 'repeat' ? repeatedSize : '100% 100%';
  const textureIsUrl = texture?.startsWith('url(');
  const textureBackgroundSize = textureIsUrl
    ? textureTileMode === 'contain' ? 'contain' : textureTileMode === 'stretch' ? '100% 100%' : repeatedSize
    : textureScale ? `${textureScale}px ${textureScale}px` : undefined;
  const backgrounds: Array<{ image?: string; size?: string; repeat?: string; position?: string }> = [
    { image: tintVector ? undefined : asset, size: assetBackgroundSize, repeat: assetTileMode === 'repeat' ? 'repeat' : 'no-repeat', position: assetTileMode === 'contain' ? 'center' : undefined },
    { image: texture, size: textureBackgroundSize, repeat: textureIsUrl ? textureTileMode === 'contain' || textureTileMode === 'stretch' ? 'no-repeat' : 'repeat' : undefined, position: textureIsUrl && textureTileMode === 'contain' ? 'center' : undefined },
    { image: gradient },
    { image: appearance.rawCss?.backgroundImage },
  ].filter(layer => layer.image);
  // CSS cycles short property lists, so include defaults for every actual layer.
  const backgroundProperty = (property: 'size' | 'repeat' | 'position', initial: string): string | undefined => backgrounds.some(layer => layer[property] !== undefined)
    ? backgrounds.flatMap(layer => Array.from({ length: backgroundLayerCount(layer.image!) }, () => layer[property] ?? initial)).join(', ')
    : undefined;
  const backgroundImage = backgrounds.map(layer => layer.image).join(', ') || undefined;
  const borderStyle = borderToStyle(border);
  const boxShadow = [borderStyle.boxShadow, effectsToBoxShadow(effects, border)]
    .filter(Boolean)
    .join(', ') || undefined;
  return {
    ...(textureIsUrl ? { '--cf-texture-layer': tintVector || !asset ? 0 : 1, '--cf-texture-strength': Math.max(0, Math.min(100, material?.texture?.intensity ?? 100)) / 100 } : {}),
    color: material?.textColor,
    backgroundColor: material?.baseColor || material?.fillColor,
    backgroundImage,
    backgroundSize: backgroundProperty('size', 'auto'),
    backgroundRepeat: backgroundProperty('repeat', 'repeat'),
    backgroundPosition: backgroundProperty('position', '0% 0%'),
    backgroundBlendMode: blendMode,
    maskImage: tintVector ? asset : undefined,
    WebkitMaskImage: tintVector ? asset : undefined,
    maskSize: tintVector ? assetBackgroundSize : undefined,
    WebkitMaskSize: tintVector ? assetBackgroundSize : undefined,
    maskRepeat: tintVector ? 'no-repeat' : undefined,
    WebkitMaskRepeat: tintVector ? 'no-repeat' : undefined,
    maskPosition: tintVector ? 'center' : undefined,
    WebkitMaskPosition: tintVector ? 'center' : undefined,
    ...(tintVector ? { backgroundColor: appearance.assetTintColor || material?.fillColor || '#ffffff' } : {}),
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
