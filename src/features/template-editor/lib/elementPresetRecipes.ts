import {
  normalizeAppearanceForElement,
  type AppearanceStylePreset,
  type FreeformAppearance,
  type FreeformCardElement,
  type FreeformElementType,
  type FreeformShapeKind,
  type FreeformShapeRole,
  type TCGCardTemplate,
} from '@/domain/templates';
import { appearanceToElementRenderFields } from '@/features/card-rendering/client';
import { DEFAULT_BUSINESS_IDENTITY } from '@/features/business-identity/client';

const DEFAULT_OWNER_CONTRIBUTOR_NAME = DEFAULT_BUSINESS_IDENTITY.legalOperatorName
  || DEFAULT_BUSINESS_IDENTITY.supportEmail;

export type ElementPresetKind =
  | 'shapeRole'
  | 'borderTreatment'
  | 'iconStyle'
  | 'dividerRecipe'
  | 'frameKit'
  | 'cardPart'
  | 'material';

export type ElementPresetSurface =
  | 'shapeFill'
  | 'shapeStroke'
  | 'textPanel'
  | 'iconGlyph'
  | 'iconBackplate'
  | 'dividerRail'
  | 'imageFrame'
  | 'templateCanvas';

export type ElementPresetTarget = FreeformElementType | 'template';

export interface ElementPresetApplicability {
  elementTypes: ElementPresetTarget[];
  roles?: FreeformShapeRole[];
  surfaces: ElementPresetSurface[];
}

export interface ElementPresetRecipe {
  id: string;
  label: string;
  description: string;
  kind: ElementPresetKind;
  contributorName: string;
  status: 'published' | 'voting' | 'archived';
  tier: 'free' | 'paid' | 'contributor';
  source: 'contributor-pipeline' | 'registry-style';
  appliesTo: ElementPresetApplicability;
  updates?: Partial<FreeformCardElement>;
  appearance?: FreeformAppearance;
  templateUpdates?: Partial<TCGCardTemplate>;
  preview?: {
    background?: string;
    borderColor?: string;
    imageUrl?: string;
    iconName?: string;
  };
}

export interface BlankShapePrimitive {
  value: FreeformShapeKind;
  label: string;
  updates: Partial<FreeformCardElement>;
}

const blankPrimitiveBase: Partial<FreeformCardElement> = {
  shapeRole: 'basic',
  appearance: undefined,
  backgroundImageUrl: undefined,
  fillColor: 'rgba(255,255,255,0.06)',
  backgroundColor: 'rgba(255,255,255,0.06)',
  strokeColor: '#d5ad54',
  borderColor: '#d5ad54',
  strokeWidth: 1,
  borderWidth: 'border',
  borderRadius: 'rounded-md',
  opacity: 1,
};

export const BLANK_SHAPE_PRIMITIVES: BlankShapePrimitive[] = [
  { value: 'rectangle', label: 'Rectangle', updates: { ...blankPrimitiveBase, shapeKind: 'rectangle', width: 320, height: 140, borderRadius: 'rounded-md' } },
  { value: 'ellipse', label: 'Ellipse', updates: { ...blankPrimitiveBase, shapeKind: 'ellipse', width: 120, height: 120, borderRadius: 'rounded-full' } },
  { value: 'capsule', label: 'Capsule', updates: { ...blankPrimitiveBase, shapeKind: 'capsule', width: 260, height: 72, borderRadius: 'rounded-full' } },
  { value: 'diamond', label: 'Diamond', updates: { ...blankPrimitiveBase, shapeKind: 'diamond', width: 96, height: 96, borderRadius: 'rounded-md' } },
  { value: 'hexagon', label: 'Hexagon', updates: { ...blankPrimitiveBase, shapeKind: 'hexagon', width: 132, height: 120, borderRadius: 'rounded-md' } },
  { value: 'banner', label: 'Banner', updates: { ...blankPrimitiveBase, shapeKind: 'banner', width: 360, height: 64, borderRadius: 'rounded-sm' } },
  { value: 'notch-panel', label: 'Notch Panel', updates: { ...blankPrimitiveBase, shapeKind: 'notch-panel', width: 360, height: 140, borderRadius: 'rounded-md' } },
  {
    value: 'bracket-frame',
    label: 'Bracket Frame',
    updates: { ...blankPrimitiveBase, shapeKind: 'bracket-frame', width: 420, height: 240, fillColor: 'transparent', backgroundColor: 'transparent', borderWidth: '_none_', strokeWidth: 2 },
  },
  {
    value: 'corner-frame',
    label: 'Corner Frame',
    updates: { ...blankPrimitiveBase, shapeKind: 'corner-frame', width: 420, height: 240, fillColor: 'transparent', backgroundColor: 'transparent', borderWidth: '_none_', strokeWidth: 2 },
  },
  {
    value: 'line',
    label: 'Line',
    updates: { ...blankPrimitiveBase, shapeKind: 'line', shapeRole: 'divider', width: 420, height: 12, fillColor: '#d5ad54', backgroundColor: '#d5ad54', borderWidth: '_none_', strokeWidth: 2, borderRadius: 'rounded-full' },
  },
];

export const createFrameKitPresetRecipes = (templates: TCGCardTemplate[]): ElementPresetRecipe[] =>
  templates.filter((template) => (
    Boolean(template.id)
    && Boolean(template.cardBackgroundImageUrl)
    && template.templateRegistryStatus === 'published'
  )).map((template) => ({
    id: `frame-kit-${template.id}`,
    label: template.name,
    description: 'CardForge Library card treatment for the full Template canvas.',
    kind: 'frameKit',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'contributor-pipeline',
    appliesTo: { elementTypes: ['template'], surfaces: ['templateCanvas'] },
    preview: { imageUrl: template.cardBackgroundImageUrl, background: template.baseBackgroundColor },
    templateUpdates: {
      aspectRatio: template.aspectRatio,
      formatId: template.formatId,
      trimWidthMm: template.trimWidthMm,
      trimHeightMm: template.trimHeightMm,
      frameStyle: 'custom',
      cardBackgroundImageUrl: template.cardBackgroundImageUrl,
      baseBackgroundColor: template.baseBackgroundColor,
      baseTextColor: template.baseTextColor,
      cardBorderColor: template.cardBorderColor,
      cardBorderWidth: template.cardBorderWidth,
      cardBorderStyle: template.cardBorderStyle,
      cardBorderRadius: template.cardBorderRadius,
      cardBorderImageSource: template.cardBorderImageSource,
    },
  }));

const appearanceKindToRecipeKind = (kind: AppearanceStylePreset['kind']): ElementPresetKind => {
  if (kind === 'shapeRole') return 'shapeRole';
  if (kind === 'frameKit' || kind === 'theme') return 'frameKit';
  if (kind === 'border') return 'borderTreatment';
  if (kind === 'divider') return 'dividerRecipe';
  if (kind === 'icon') return 'iconStyle';
  return 'material';
};

const targetToElementType = (target: AppearanceStylePreset['targets'][number]): ElementPresetTarget | null =>
  target === 'template'
    ? 'template'
    : target === 'text' || target === 'image' || target === 'icon' || target === 'shape' || target === 'divider'
      ? target === 'divider' ? 'shape' : target
      : null;

const appearanceSurfacesForStyle = (style: AppearanceStylePreset): ElementPresetSurface[] => {
  if (style.kind === 'shapeRole') return ['shapeFill', 'shapeStroke'];
  if (style.kind === 'frameKit') return ['templateCanvas'];
  if (style.kind === 'textFrame') return ['textPanel'];
  if (style.kind === 'border') return ['textPanel', 'imageFrame', 'iconBackplate', 'shapeStroke'];
  if (style.kind === 'divider') return ['dividerRail'];
  if (style.kind === 'icon') return ['iconGlyph', 'iconBackplate'];
  if (style.targets.includes('template')) return ['templateCanvas'];
  return ['textPanel', 'shapeFill'];
};

const appearanceStyleStatusToRecipeStatus = (
  status: AppearanceStylePreset['registryStatus'],
): ElementPresetRecipe['status'] => {
  if (status === 'archived' || status === 'rejected') return 'archived';
  if (status === 'draft' || status === 'submitted' || status === 'voting' || status === 'publish_candidate') return 'voting';
  return 'published';
};

const appearanceStyleTierToRecipeTier = (
  tier: AppearanceStylePreset['accessTier'],
): ElementPresetRecipe['tier'] =>
  tier === 'contributor' || tier === 'free' || tier === 'paid' ? tier : 'free';

export const createRecipesFromAppearanceStyles = (styles: AppearanceStylePreset[]): ElementPresetRecipe[] =>
  styles.map((style) => {
    const elementTypes = Array.from(new Set(
      style.targets.map(targetToElementType).filter((target): target is ElementPresetTarget => Boolean(target)),
    ));
    return {
      id: style.id,
      label: style.name,
      description: style.librarySource === 'contributor'
        ? 'Shared contributor appearance preset.'
        : 'CardForge starter appearance preset.',
      kind: appearanceKindToRecipeKind(style.kind),
      contributorName: style.contributorName
        || (style.librarySource === 'contributor' ? 'CardForge contributor' : DEFAULT_OWNER_CONTRIBUTOR_NAME),
      status: appearanceStyleStatusToRecipeStatus(style.registryStatus),
      tier: appearanceStyleTierToRecipeTier(style.accessTier),
      source: style.librarySource === 'contributor' ? 'contributor-pipeline' : 'registry-style',
      appliesTo: {
        elementTypes: elementTypes.length ? elementTypes : ['text', 'shape'],
        roles: style.targets.includes('divider') ? ['divider'] : undefined,
        surfaces: appearanceSurfacesForStyle(style),
      },
      preview: {
        background: style.appearance.material?.baseColor,
        borderColor: style.appearance.border?.color,
        imageUrl: style.appearance.dividerAsset
          || style.appearance.assetSource
          || style.appearance.material?.texture?.assetSource,
      },
      updates: style.updates,
      appearance: style.appearance,
      templateUpdates: style.templateUpdates,
    };
  });

export const buildElementPresetElementUpdates = (
  recipe: ElementPresetRecipe,
  element: FreeformCardElement,
): Partial<FreeformCardElement> => {
  const updates: Partial<FreeformCardElement> = { ...(recipe.updates || {}) };
  if (element.type === 'icon' && element.iconImageSource && recipe.kind === 'iconStyle') {
    delete updates.iconName;
    delete updates.iconImageSource;
  }

  if (recipe.appearance) {
    const nextElement = { ...element, ...updates, appearance: recipe.appearance };
    return {
      ...updates,
      appearance: recipe.appearance,
      ...appearanceToElementRenderFields(nextElement),
    };
  }

  if (recipe.kind === 'dividerRecipe' || recipe.kind === 'shapeRole') {
    const nextElement = { ...element, ...updates } as FreeformCardElement;
    return { ...updates, appearance: normalizeAppearanceForElement(nextElement) };
  }

  return updates;
};

export const isElementPresetApplicable = (
  preset: ElementPresetRecipe,
  element: Pick<FreeformCardElement, 'type' | 'shapeRole' | 'appearance'>,
): boolean => {
  if (!preset.appliesTo.elementTypes.includes(element.type)) return false;
  if (!preset.appliesTo.roles?.length) return true;
  const role = element.shapeRole || element.appearance?.shapeRole || 'basic';
  return preset.appliesTo.roles.includes(role);
};
