import type {
  AppearanceStyleKind,
  AppearanceStylePreset,
  AppearanceTarget,
  FreeformAppearance,
  FreeformShapeKind,
  FreeformShapeRole,
  TCGCardTemplate,
} from '@/domain/templates';

const APPEARANCE_STYLE_KINDS = new Set<AppearanceStyleKind>([
  'material',
  'border',
  'divider',
  'icon',
  'theme',
  'shapeRole',
  'frameKit',
  'textFrame',
]);

const APPEARANCE_TARGETS = new Set<AppearanceTarget>([
  'element',
  'text',
  'image',
  'icon',
  'shape',
  'divider',
  'template',
]);

const GRADIENT_TYPES = new Set(['linear', 'radial', 'none']);
const TEXTURE_KINDS = new Set(['none', 'parchment', 'foil', 'etched', 'grain', 'hatch', 'uploaded']);
const BORDER_KINDS = new Set(['none', 'solid', 'double', 'etched', 'relic', 'foil']);
const TILE_MODES = new Set(['repeat', 'stretch', 'contain']);
const ASSET_KINDS = new Set(['texture', 'divider', 'border', 'frame']);
const SHAPE_ROLES = new Set<FreeformShapeRole>(['basic', 'panel', 'artFrame', 'rulesBox', 'titlePlate', 'statGem', 'costOrb', 'divider']);
const SHAPE_KINDS = new Set<FreeformShapeKind>(['rectangle', 'ellipse', 'diamond', 'hexagon', 'capsule', 'banner', 'notch-panel', 'bracket-frame', 'corner-frame', 'line']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';
const isOptionalNumber = (value: unknown): boolean => value === undefined || (typeof value === 'number' && Number.isFinite(value));
const isOptionalEnum = (value: unknown, values: Set<string>): boolean => value === undefined || (typeof value === 'string' && values.has(value));

const isSafeGradient = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.type !== 'string' || !GRADIENT_TYPES.has(value.type)) return false;
  if (!isOptionalNumber(value.angle) || !Array.isArray(value.stops)) return false;
  return value.stops.every((stop) => isRecord(stop)
    && typeof stop.id === 'string'
    && stop.id.trim().length > 0
    && typeof stop.color === 'string'
    && typeof stop.position === 'number'
    && Number.isFinite(stop.position)
    && isOptionalNumber(stop.opacity));
};

const isSafeTexture = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.kind !== 'string' || !TEXTURE_KINDS.has(value.kind)) return false;
  return isOptionalNumber(value.intensity)
    && isOptionalNumber(value.scale)
    && isOptionalNumber(value.textureScale)
    && isOptionalNumber(value.textureOpacity)
    && isOptionalString(value.imageSource)
    && isOptionalString(value.assetSource)
    && isOptionalString(value.blendMode)
    && isOptionalEnum(value.assetKind, ASSET_KINDS)
    && isOptionalEnum(value.tileMode, TILE_MODES);
};

const isSafeAppearance = (value: unknown): value is FreeformAppearance => {
  if (!isRecord(value)) return false;
  if (!isOptionalString(value.assetSource)
    || !isOptionalString(value.blendMode)
    || !isOptionalString(value.dividerAsset)
    || !isOptionalNumber(value.textureScale)
    || !isOptionalNumber(value.textureOpacity)
    || !isOptionalEnum(value.assetKind, ASSET_KINDS)
    || !isOptionalEnum(value.tileMode, TILE_MODES)
    || (value.shapeRole !== undefined && (typeof value.shapeRole !== 'string' || !SHAPE_ROLES.has(value.shapeRole as FreeformShapeRole)))) {
    return false;
  }

  if (value.material !== undefined) {
    const material = value.material;
    if (!isRecord(material)) return false;
    if (!['name', 'baseColor', 'textColor', 'fillColor', 'strokeColor'].every((key) => isOptionalString(material[key]))) return false;
    if (material.gradient !== undefined && !isSafeGradient(material.gradient)) return false;
    if (material.texture !== undefined && !isSafeTexture(material.texture)) return false;
  }

  if (value.border !== undefined) {
    const border = value.border;
    if (!isRecord(border)
      || typeof border.kind !== 'string'
      || !BORDER_KINDS.has(border.kind)
      || !['color', 'secondaryColor'].every((key) => isOptionalString(border[key]))
      || !['width', 'radius', 'innerWidth', 'outerWidth'].every((key) => isOptionalNumber(border[key]))) {
      return false;
    }
  }

  if (value.effects !== undefined) {
    const effects = value.effects;
    if (!isRecord(effects)
      || !['shadow', 'glow', 'bevel', 'innerHighlight', 'overlayOpacity'].every((key) => isOptionalNumber(effects[key]))) {
      return false;
    }
  }

  if (value.rawCss !== undefined) {
    if (!isRecord(value.rawCss)
      || !isOptionalString(value.rawCss.backgroundImage)
      || !isOptionalString(value.rawCss.borderImageSource)) {
      return false;
    }
  }

  return true;
};

export type RepositoryTemplate = TCGCardTemplate & {
  id: string;
  name: string;
  aspectRatio: string;
};

export const isRepositoryTemplate = (value: unknown): value is RepositoryTemplate => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TCGCardTemplate>;
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0
    && typeof candidate.aspectRatio === 'string';
};

export const isRepositoryStyle = (value: unknown): value is AppearanceStylePreset => {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<AppearanceStylePreset>;
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0
    && typeof candidate.kind === 'string'
    && APPEARANCE_STYLE_KINDS.has(candidate.kind as AppearanceStyleKind)
    && Array.isArray(candidate.targets)
    && candidate.targets.length > 0
    && candidate.targets.every((target) => APPEARANCE_TARGETS.has(target as AppearanceTarget))
    && isSafeAppearance(candidate.appearance)
    && (candidate.updates === undefined || (
      isRecord(candidate.updates)
      && (candidate.updates.shapeKind === undefined
        || (typeof candidate.updates.shapeKind === 'string' && SHAPE_KINDS.has(candidate.updates.shapeKind)))
    ));
};
