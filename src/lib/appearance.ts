import type { CSSProperties } from 'react';
import type {
  AppearanceBorder,
  AppearanceEffects,
  AppearanceGradient,
  AppearanceStylePreset,
  AppearanceTexture,
  FreeformAppearance,
  FreeformCardElement,
  TCGCardTemplate,
} from '@/types';
import { findCardAsset } from '@/lib/cardAssets';

export const DEFAULT_APPEARANCE_LIBRARY: AppearanceStylePreset[] = [
  {
    id: 'material-parchment-aged',
    name: 'Aged Parchment',
    kind: 'material',
    targets: ['text', 'shape', 'element'],
    appearance: {
      material: {
        baseColor: 'rgba(235,211,159,0.96)',
        textColor: '#221407',
        gradient: {
          type: 'linear',
          angle: 180,
          stops: [
            { id: 'a', color: '#fff6d8', position: 0, opacity: 0.96 },
            { id: 'b', color: '#c69343', position: 100, opacity: 0.36 },
          ],
        },
        texture: { kind: 'uploaded', imageSource: '/card-assets/textures/parchment-grain.svg', assetSource: '/card-assets/textures/parchment-grain.svg', assetKind: 'texture', intensity: 55, scale: 8, textureOpacity: 42, textureScale: 160, blendMode: 'multiply' },
      },
      border: { kind: 'relic', color: '#5a3410', secondaryColor: '#d5ad54', width: 4, radius: 6, innerWidth: 1 },
      effects: { innerHighlight: 35, bevel: 25 },
    },
  },
  {
    id: 'material-obsidian-gilt',
    name: 'Obsidian Gilt',
    kind: 'material',
    targets: ['text', 'shape', 'element'],
    appearance: {
      material: {
        baseColor: '#120f0b',
        textColor: '#f7e6b0',
        gradient: {
          type: 'radial',
          stops: [
            { id: 'a', color: '#d5ad54', position: 0, opacity: 0.22 },
            { id: 'b', color: '#120f0b', position: 100, opacity: 1 },
          ],
        },
        texture: { kind: 'uploaded', imageSource: '/card-assets/textures/dark-leather.svg', assetSource: '/card-assets/textures/dark-leather.svg', assetKind: 'texture', intensity: 42, scale: 9, textureOpacity: 46, textureScale: 180, blendMode: 'overlay' },
      },
      border: { kind: 'etched', color: '#d5ad54', secondaryColor: '#5f4216', width: 4, radius: 8, innerWidth: 1 },
      effects: { shadow: 28, glow: 14, bevel: 35 },
    },
  },
  {
    id: 'material-purple-foil',
    name: 'Purple Foil',
    kind: 'material',
    targets: ['text', 'shape', 'icon', 'element'],
    appearance: {
      material: {
        baseColor: '#160d25',
        textColor: '#f4eaff',
        gradient: {
          type: 'linear',
          angle: 135,
          stops: [
            { id: 'a', color: '#7a52cc', position: 0, opacity: 0.92 },
            { id: 'b', color: '#260e4a', position: 52, opacity: 0.96 },
            { id: 'c', color: '#d5ad54', position: 100, opacity: 0.24 },
          ],
        },
        texture: { kind: 'uploaded', imageSource: '/card-assets/textures/purple-foil.svg', assetSource: '/card-assets/textures/purple-foil.svg', assetKind: 'texture', intensity: 60, scale: 16, textureOpacity: 44, textureScale: 190, blendMode: 'screen' },
      },
      border: { kind: 'foil', color: '#7a52cc', secondaryColor: '#d5ad54', width: 3, radius: 10 },
      effects: { glow: 24, innerHighlight: 28 },
    },
  },
  {
    id: 'frame-mtg-rules',
    name: 'MTG Rules Frame',
    kind: 'textFrame',
    targets: ['text'],
    appearance: {
      material: {
        baseColor: 'rgba(244,226,186,0.94)',
        textColor: '#20140a',
        gradient: {
          type: 'linear',
          angle: 180,
          stops: [
            { id: 'a', color: '#fffae6', position: 0, opacity: 0.96 },
            { id: 'b', color: '#d6b269', position: 100, opacity: 0.38 },
          ],
        },
        texture: { kind: 'uploaded', imageSource: '/card-assets/textures/worn-paper.svg', assetSource: '/card-assets/textures/worn-paper.svg', assetKind: 'texture', intensity: 38, scale: 10, textureOpacity: 38, textureScale: 170, blendMode: 'multiply' },
      },
      border: { kind: 'relic', color: '#4a2f12', secondaryColor: '#d5ad54', width: 4, radius: 6 },
      effects: { bevel: 24, innerHighlight: 30 },
    },
  },
  {
    id: 'divider-gem-center',
    name: 'Gem Center Divider',
    kind: 'divider',
    targets: ['divider', 'shape'],
    appearance: {
      dividerAsset: '/card-assets/dividers/gem-center.svg',
      assetKind: 'divider',
      shapeRole: 'divider',
      material: {
        baseColor: '#d5ad54',
        gradient: {
          type: 'linear',
          angle: 90,
          stops: [
            { id: 'a', color: 'transparent', position: 0 },
            { id: 'b', color: '#7f5d1f', position: 20 },
            { id: 'c', color: '#f5d27b', position: 47 },
            { id: 'd', color: '#7a52cc', position: 50 },
            { id: 'e', color: '#f5d27b', position: 53 },
            { id: 'f', color: '#7f5d1f', position: 80 },
            { id: 'g', color: 'transparent', position: 100 },
          ],
        },
        texture: { kind: 'none' },
      },
      border: { kind: 'none', radius: 999 },
    },
  },
  {
    id: 'icon-fire-relic',
    name: 'Fire Relic Icon',
    kind: 'icon',
    targets: ['icon'],
    appearance: {
      material: { baseColor: '#210b06', textColor: '#ffb35f', fillColor: 'rgba(132,37,15,0.72)', strokeColor: '#ffb35f' },
      border: { kind: 'solid', color: '#d67425', width: 1, radius: 999 },
      effects: { glow: 20 },
    },
  },
];

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
  const assetMeta = findCardAsset(assetSource);
  const tileMode = appearance.tileMode ?? material?.texture?.tileMode ?? assetMeta?.tileMode;
  const assetBackgroundSize = tileMode === 'contain' ? 'contain' : tileMode === 'repeat' ? `${textureScale || assetMeta?.defaultScale || 160}px ${textureScale || assetMeta?.defaultScale || 160}px` : '100% 100%';
  const textureBackgroundSize = textureScale ? `${textureScale}px ${textureScale}px` : texture?.startsWith('url(') ? '160px 160px' : undefined;
  return {
    color: material?.textColor,
    backgroundColor: material?.baseColor || material?.fillColor,
    backgroundImage,
    backgroundSize: asset ? assetBackgroundSize : textureBackgroundSize,
    backgroundRepeat: asset ? (tileMode === 'repeat' ? 'repeat' : 'no-repeat') : texture?.startsWith('url(') ? 'repeat' : undefined,
    backgroundPosition: asset && tileMode === 'contain' ? 'center' : undefined,
    backgroundBlendMode: blendMode,
    borderColor: border?.color,
    borderWidth: border && border.kind !== 'none' ? border.width : undefined,
    borderStyle: border && border.kind !== 'none' ? (border.kind === 'double' ? 'double' : 'solid') : undefined,
    borderRadius: border?.radius !== undefined ? `${border.radius}px` : undefined,
    boxShadow: effectsToBoxShadow(effects, border),
  };
};

export const appearanceToLegacyElementFields = (element: FreeformCardElement): Partial<FreeformCardElement> => {
  const style = appearanceToStyle(element.appearance);
  return {
    backgroundColor: typeof style.backgroundColor === 'string' ? style.backgroundColor : element.backgroundColor,
    backgroundImageUrl: typeof style.backgroundImage === 'string' ? style.backgroundImage : element.backgroundImageUrl,
    textColor: element.appearance?.material?.textColor || element.textColor,
    fillColor: element.appearance?.material?.fillColor || element.appearance?.material?.baseColor || element.fillColor,
    strokeColor: element.appearance?.material?.strokeColor || element.appearance?.border?.color || element.strokeColor,
    borderColor: element.appearance?.border?.color || element.borderColor,
    borderRadius: element.appearance?.border?.radius !== undefined ? radiusToClass(element.appearance.border.radius) : element.borderRadius,
    borderWidth: element.appearance?.border?.width !== undefined ? pixelsToBorderClass(element.appearance.border.width) : element.borderWidth,
    strokeWidth: element.appearance?.border?.width ?? element.strokeWidth,
  };
};

export const normalizeAppearanceForElement = (element: Partial<FreeformCardElement>): FreeformAppearance => {
  if (element.appearance) return element.appearance;
  const baseColor = element.backgroundColor || element.fillColor || (element.type === 'text' ? 'transparent' : undefined);
  const rawBackground = element.backgroundImageUrl;
  return {
    material: {
      baseColor,
      textColor: element.textColor,
      fillColor: element.fillColor,
      strokeColor: element.strokeColor,
      gradient: rawBackground && (rawBackground.startsWith('linear-gradient') || rawBackground.startsWith('radial-gradient'))
        ? DEFAULT_APPEARANCE_LIBRARY[0].appearance.material?.gradient
        : undefined,
      texture: rawBackground ? { kind: 'parchment', intensity: 25, scale: 10 } : { kind: 'none' },
    },
    border: {
      kind: element.borderWidth && element.borderWidth !== '_none_' ? 'solid' : 'none',
      color: element.borderColor || element.strokeColor,
      width: borderClassToPixels(element.borderWidth) || element.strokeWidth || 0,
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

const borderClassToPixels = (value?: string): number => {
  if (!value || value === '_none_') return 0;
  if (value === 'border') return 1;
  const match = value.match(/border-(\d+)/);
  return match ? Number(match[1]) : 1;
};

const radiusClassToPixels = (value?: string): number => {
  if (!value) return 0;
  if (value === 'rounded-sm') return 2;
  if (value === 'rounded-md') return 6;
  if (value === 'rounded-lg') return 8;
  if (value === 'rounded-xl') return 12;
  if (value === 'rounded-full') return 999;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
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
