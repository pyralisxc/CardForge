import type {
  AppearanceStylePreset,
  FreeformAppearance,
  FreeformCardElement,
  FreeformElementType,
  FreeformShapeKind,
  FreeformShapeRole,
  TCGCardTemplate,
} from '@/types';
import type { CardFrameKit } from '@/lib/cardFrameKits';
import { getFrameKitTemplateUpdates } from '@/lib/cardFrameKits';
import { appearanceToElementRenderFields, normalizeAppearanceForElement } from '@/lib/appearance';
import { DEFAULT_OWNER_SETTINGS } from '@/lib/ownerConsole';

const DEFAULT_OWNER_CONTRIBUTOR_NAME = DEFAULT_OWNER_SETTINGS.ownerName || DEFAULT_OWNER_SETTINGS.supportEmail;

export type ElementPresetKind =
  | 'shapeRole'
  | 'textFrame'
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
  tier: 'free' | 'paid' | 'developer';
  source: 'developer-pipeline' | 'registry-style';
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
  {
    value: 'rectangle',
    label: 'Rectangle',
    updates: { ...blankPrimitiveBase, shapeKind: 'rectangle', width: 320, height: 140, borderRadius: 'rounded-md' },
  },
  {
    value: 'ellipse',
    label: 'Ellipse',
    updates: { ...blankPrimitiveBase, shapeKind: 'ellipse', width: 120, height: 120, borderRadius: 'rounded-full' },
  },
  {
    value: 'capsule',
    label: 'Capsule',
    updates: { ...blankPrimitiveBase, shapeKind: 'capsule', width: 260, height: 72, borderRadius: 'rounded-full' },
  },
  {
    value: 'diamond',
    label: 'Diamond',
    updates: { ...blankPrimitiveBase, shapeKind: 'diamond', width: 96, height: 96, borderRadius: 'rounded-md' },
  },
  {
    value: 'hexagon',
    label: 'Hexagon',
    updates: { ...blankPrimitiveBase, shapeKind: 'hexagon', width: 132, height: 120, borderRadius: 'rounded-md' },
  },
  {
    value: 'banner',
    label: 'Banner',
    updates: { ...blankPrimitiveBase, shapeKind: 'banner', width: 360, height: 64, borderRadius: 'rounded-sm' },
  },
  {
    value: 'notch-panel',
    label: 'Notch Panel',
    updates: { ...blankPrimitiveBase, shapeKind: 'notch-panel', width: 360, height: 140, borderRadius: 'rounded-md' },
  },
  {
    value: 'bracket-frame',
    label: 'Bracket Frame',
    updates: {
      ...blankPrimitiveBase,
      shapeKind: 'bracket-frame',
      width: 420,
      height: 240,
      fillColor: 'transparent',
      backgroundColor: 'transparent',
      borderWidth: '_none_',
      strokeWidth: 2,
    },
  },
  {
    value: 'corner-frame',
    label: 'Corner Frame',
    updates: {
      ...blankPrimitiveBase,
      shapeKind: 'corner-frame',
      width: 420,
      height: 240,
      fillColor: 'transparent',
      backgroundColor: 'transparent',
      borderWidth: '_none_',
      strokeWidth: 2,
    },
  },
  {
    value: 'line',
    label: 'Line',
    updates: {
      ...blankPrimitiveBase,
      shapeKind: 'line',
      shapeRole: 'divider',
      width: 420,
      height: 12,
      fillColor: '#d5ad54',
      backgroundColor: '#d5ad54',
      borderWidth: '_none_',
      strokeWidth: 2,
      borderRadius: 'rounded-full',
    },
  },
];

export const SHAPE_ROLE_PRESET_RECIPES: ElementPresetRecipe[] = [
  {
    id: 'shape-role-panel',
    label: 'Panel',
    description: 'Developer-pipeline recipe for a reusable card panel.',
    kind: 'shapeRole',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['shape'], surfaces: ['shapeFill', 'shapeStroke'] },
    updates: {
      shapeRole: 'panel',
      shapeKind: 'rectangle',
      width: 360,
      height: 140,
      borderRadius: 'rounded-md',
      appearance: {
        shapeRole: 'panel',
        material: {
          baseColor: 'rgba(18,15,11,0.72)',
          texture: {
            kind: 'uploaded',
            assetSource: '/card-assets/textures/dark-leather.svg',
            assetKind: 'texture',
            textureOpacity: 42,
            textureScale: 180,
            blendMode: 'overlay',
          },
        },
        border: { kind: 'relic', color: '#d5ad54', width: 2, radius: 8 },
        effects: { innerHighlight: 18, bevel: 20 },
      },
    },
  },
  {
    id: 'shape-role-art-frame',
    label: 'Art Frame',
    description: 'Developer-pipeline recipe for an art window frame.',
    kind: 'shapeRole',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['shape'], surfaces: ['imageFrame', 'shapeStroke'] },
    updates: {
      shapeRole: 'artFrame',
      shapeKind: 'corner-frame',
      width: 500,
      height: 330,
      fillColor: 'transparent',
      backgroundColor: 'transparent',
      appearance: {
        shapeRole: 'artFrame',
        material: { baseColor: 'rgba(0,0,0,0.04)', texture: { kind: 'none' } },
        border: { kind: 'relic', color: '#d5ad54', secondaryColor: '#7a52cc', width: 4, radius: 10 },
        effects: { glow: 10, innerHighlight: 16 },
      },
    },
  },
  {
    id: 'shape-role-rules-box',
    label: 'Rules Box',
    description: 'Developer-pipeline recipe for readable rules panels.',
    kind: 'shapeRole',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['shape'], surfaces: ['shapeFill', 'textPanel'] },
    updates: {
      shapeRole: 'rulesBox',
      shapeKind: 'notch-panel',
      width: 500,
      height: 180,
      appearance: {
        shapeRole: 'rulesBox',
        material: {
          baseColor: 'rgba(244,226,186,0.94)',
          textColor: '#20140a',
          texture: {
            kind: 'uploaded',
            assetSource: '/card-assets/textures/parchment-grain.svg',
            assetKind: 'texture',
            textureOpacity: 46,
            textureScale: 160,
            blendMode: 'multiply',
          },
        },
        border: { kind: 'relic', color: '#4a2f12', secondaryColor: '#d5ad54', width: 4, radius: 8 },
        effects: { innerHighlight: 28, bevel: 22 },
      },
    },
  },
  {
    id: 'shape-role-title-plate',
    label: 'Title Plate',
    description: 'Developer-pipeline recipe for title and type-line plates.',
    kind: 'shapeRole',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['shape'], surfaces: ['shapeFill', 'textPanel'] },
    updates: {
      shapeRole: 'titlePlate',
      shapeKind: 'banner',
      width: 430,
      height: 48,
      appearance: {
        shapeRole: 'titlePlate',
        material: {
          baseColor: '#17100b',
          textColor: '#f7df9d',
          texture: {
            kind: 'uploaded',
            assetSource: '/card-assets/textures/hammered-metal.svg',
            assetKind: 'texture',
            textureOpacity: 28,
            textureScale: 150,
            blendMode: 'overlay',
          },
        },
        border: { kind: 'double', color: '#d5ad54', width: 2, radius: 6 },
        effects: { glow: 8, bevel: 18 },
      },
    },
  },
  {
    id: 'shape-role-stat-gem',
    label: 'Stat Gem',
    description: 'Developer-pipeline recipe for small stat diamonds.',
    kind: 'shapeRole',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['shape'], surfaces: ['shapeFill', 'shapeStroke'] },
    updates: {
      shapeRole: 'statGem',
      shapeKind: 'diamond',
      width: 64,
      height: 64,
      appearance: {
        shapeRole: 'statGem',
        material: {
          baseColor: '#0b0f15',
          texture: {
            kind: 'uploaded',
            assetSource: '/card-assets/textures/purple-foil.svg',
            assetKind: 'texture',
            textureOpacity: 36,
            textureScale: 190,
            blendMode: 'screen',
          },
        },
        border: { kind: 'foil', color: '#d5ad54', secondaryColor: '#7a52cc', width: 3, radius: 8 },
        effects: { glow: 16 },
      },
    },
  },
  {
    id: 'shape-role-cost-orb',
    label: 'Cost Orb',
    description: 'Developer-pipeline recipe for circular counters.',
    kind: 'shapeRole',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['shape'], surfaces: ['shapeFill', 'shapeStroke'] },
    updates: {
      shapeRole: 'costOrb',
      shapeKind: 'ellipse',
      width: 64,
      height: 64,
      borderRadius: 'rounded-full',
      appearance: {
        shapeRole: 'costOrb',
        material: {
          baseColor: '#0b0f15',
          texture: {
            kind: 'uploaded',
            assetSource: '/card-assets/textures/hammered-metal.svg',
            assetKind: 'texture',
            textureOpacity: 34,
            textureScale: 150,
            blendMode: 'overlay',
          },
        },
        border: { kind: 'foil', color: '#d5ad54', secondaryColor: '#f5d27b', width: 3, radius: 999 },
        effects: { glow: 14, innerHighlight: 20 },
      },
    },
  },
];

export const TEXT_FRAME_PRESET_RECIPES: ElementPresetRecipe[] = [
  {
    id: 'text-frame-mtg-rules',
    label: 'MTG Rules Frame',
    description: 'Readable fantasy rules text panel.',
    kind: 'textFrame',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['text'], surfaces: ['textPanel'] },
    preview: { background: 'rgba(244,226,186,0.94)', borderColor: '#4a2f12' },
    updates: {
      backgroundColor: 'rgba(244,226,186,0.94)',
      backgroundImageUrl: 'linear-gradient(180deg, rgba(255,250,230,0.96), rgba(214,178,105,0.38))',
      textColor: '#20140a',
      borderColor: '#4a2f12',
      borderWidth: 'border-4',
      borderRadius: 'rounded-md',
      padding: 'p-3',
    },
  },
  {
    id: 'text-frame-black-legendary',
    label: 'Black Legendary',
    description: 'Dark relic text panel for premium fantasy cards.',
    kind: 'textFrame',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['text'], surfaces: ['textPanel'] },
    preview: { background: '#15100b', borderColor: '#d5ad54' },
    updates: {
      backgroundColor: '#15100b',
      backgroundImageUrl: 'linear-gradient(180deg, rgba(213,173,84,0.2), rgba(0,0,0,0.2))',
      textColor: '#f7e6b0',
      borderColor: '#d5ad54',
      borderWidth: 'border-2',
      borderRadius: 'rounded-lg',
      padding: 'p-3',
    },
  },
  {
    id: 'text-frame-violet-spellbox',
    label: 'Violet Spellbox',
    description: 'Arcane spell panel with violet light and readable contrast.',
    kind: 'textFrame',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['text'], surfaces: ['textPanel'] },
    preview: { background: '#1a102c', borderColor: '#bda2ff' },
    updates: {
      backgroundColor: '#1a102c',
      backgroundImageUrl: 'linear-gradient(135deg, rgba(122,82,204,0.44), rgba(7,9,14,0.96))',
      textColor: '#f1e8ff',
      borderColor: '#bda2ff',
      borderWidth: 'border-2',
      borderRadius: 'rounded-xl',
      padding: 'p-3',
    },
  },
  {
    id: 'text-frame-gold-nameplate',
    label: 'Gold Nameplate',
    description: 'Centered title plate treatment for names and type lines.',
    kind: 'textFrame',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['text'], surfaces: ['textPanel'] },
    preview: { background: '#17100b', borderColor: '#d5ad54' },
    updates: {
      backgroundColor: '#17100b',
      backgroundImageUrl: 'linear-gradient(90deg, rgba(0,0,0,0.38), rgba(213,173,84,0.24), rgba(0,0,0,0.38))',
      textColor: '#f7df9d',
      borderColor: '#d5ad54',
      borderWidth: 'border-2',
      borderRadius: 'rounded-md',
      padding: 'p-2',
      fontWeight: 'font-bold',
      textAlign: 'center',
    },
  },
  {
    id: 'text-frame-flavor-scroll',
    label: 'Flavor Scroll',
    description: 'Soft scroll-style panel for flavor copy.',
    kind: 'textFrame',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['text'], surfaces: ['textPanel'] },
    preview: { background: 'rgba(248,235,201,0.9)', borderColor: '#8b6424' },
    updates: {
      backgroundColor: 'rgba(248,235,201,0.9)',
      backgroundImageUrl: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.54), transparent 42%), linear-gradient(180deg, rgba(255,246,218,0.95), rgba(207,166,89,0.3))',
      textColor: '#3a2411',
      borderColor: '#8b6424',
      borderWidth: 'border-2',
      borderRadius: 'rounded-xl',
      padding: 'p-4',
      fontStyle: 'italic',
    },
  },
  {
    id: 'text-frame-aged-parchment',
    label: 'Aged Parchment',
    description: 'Grain-heavy parchment panel for rules or lore.',
    kind: 'textFrame',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['text'], surfaces: ['textPanel'] },
    preview: { background: 'rgba(235,211,159,0.96)', borderColor: '#5a3410' },
    updates: {
      backgroundColor: 'rgba(235,211,159,0.96)',
      backgroundImageUrl: 'radial-gradient(circle at 15% 20%, rgba(80,42,13,0.14), transparent 18%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.38), transparent 22%), repeating-linear-gradient(0deg, rgba(80,42,13,0.045) 0 1px, transparent 1px 8px), linear-gradient(180deg, rgba(255,249,220,0.96), rgba(198,147,67,0.36))',
      textColor: '#221407',
      borderColor: '#5a3410',
      borderWidth: 'border-4',
      borderRadius: 'rounded-md',
      padding: 'p-4',
    },
  },
  {
    id: 'text-frame-carved-obsidian',
    label: 'Carved Obsidian',
    description: 'Etched dark panel with strong fantasy frame styling.',
    kind: 'textFrame',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['text'], surfaces: ['textPanel'] },
    preview: { background: '#0d0b09', borderColor: '#d5ad54' },
    updates: {
      backgroundColor: '#0d0b09',
      backgroundImageUrl: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.055) 0 2px, transparent 2px 10px), linear-gradient(180deg, rgba(213,173,84,0.18), rgba(0,0,0,0.38))',
      textColor: '#f7e6b0',
      borderColor: '#d5ad54',
      borderWidth: 'border-4',
      borderRadius: 'rounded-lg',
      padding: 'p-4',
    },
  },
];

const createBorderTreatmentRecipe = ({
  id,
  label,
  description,
  border,
  background,
  rawBackgroundImage,
}: Pick<ElementPresetRecipe, 'id' | 'label' | 'description'> & {
  border: NonNullable<FreeformAppearance['border']>;
  background: string;
  rawBackgroundImage?: string;
}): ElementPresetRecipe => ({
  id,
  label,
  description,
  kind: 'borderTreatment',
  contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
  status: 'published',
  tier: 'free',
  source: 'developer-pipeline',
  appliesTo: {
    elementTypes: ['text', 'image', 'icon', 'shape'],
    surfaces: ['textPanel', 'imageFrame', 'iconBackplate', 'shapeStroke'],
  },
  preview: { background, borderColor: border.kind === 'none' ? 'transparent' : border.color },
  appearance: {
    material: rawBackgroundImage ? { baseColor: background } : undefined,
    border,
    rawCss: rawBackgroundImage ? { backgroundImage: rawBackgroundImage } : undefined,
  },
});

export const BORDER_PRESET_RECIPES: ElementPresetRecipe[] = [
  createBorderTreatmentRecipe({
    id: 'border-none',
    label: 'None',
    description: 'Remove the selected element edge.',
    background: '#111720',
    border: { kind: 'none', width: 0, radius: 0 },
  }),
  createBorderTreatmentRecipe({
    id: 'border-gold-hairline',
    label: 'Gold Hairline',
    description: 'Fine gold edge for light structure.',
    background: '#111720',
    border: { kind: 'solid', color: '#d5ad54', width: 1, radius: 6 },
  }),
  createBorderTreatmentRecipe({
    id: 'border-heavy-relic',
    label: 'Heavy Relic',
    description: 'Heavier relic edge for panels and frames.',
    background: '#17100b',
    border: { kind: 'relic', color: '#9f742a', secondaryColor: '#d5ad54', width: 4, radius: 8, innerWidth: 1 },
  }),
  createBorderTreatmentRecipe({
    id: 'border-arcane-edge',
    label: 'Arcane Edge',
    description: 'Violet magical edge for arcane components.',
    background: '#160d25',
    border: { kind: 'foil', color: '#7a52cc', secondaryColor: '#bda2ff', width: 2, radius: 12 },
  }),
  createBorderTreatmentRecipe({
    id: 'border-circle-seal',
    label: 'Circle Seal',
    description: 'Circular seal edge for counters and icon backplates.',
    background: '#151008',
    border: { kind: 'double', color: '#d5ad54', width: 2, radius: 999 },
  }),
  createBorderTreatmentRecipe({
    id: 'border-etched-frame',
    label: 'Etched Frame',
    description: 'Engraved gold edge with a subtle etched surface.',
    background: '#140f09',
    border: { kind: 'etched', color: '#d5ad54', secondaryColor: '#5f4216', width: 4, radius: 6, innerWidth: 1 },
    rawBackgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px), linear-gradient(180deg, rgba(213,173,84,0.18), transparent)',
  }),
  createBorderTreatmentRecipe({
    id: 'border-violet-relic',
    label: 'Violet Relic',
    description: 'Premium violet relic edge with stronger foil signal.',
    background: '#160d25',
    border: { kind: 'relic', color: '#7a52cc', secondaryColor: '#d8c4ff', width: 4, radius: 12, innerWidth: 1 },
    rawBackgroundImage: 'linear-gradient(135deg, rgba(122,82,204,0.28), rgba(213,173,84,0.12), rgba(0,0,0,0.22))',
  }),
];

export const DIVIDER_PRESET_RECIPES: ElementPresetRecipe[] = [
  { id: 'divider-gilded-filigree-seed', label: 'Gilded Filigree', description: 'Gold ornamental divider rail.', kind: 'dividerRecipe', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['shape'], roles: ['divider'], surfaces: ['dividerRail'] }, preview: { background: 'linear-gradient(90deg, transparent 0%, #7f5d1f 8%, #f5d27b 18%, #7f5d1f 28%, transparent 36%, #d5ad54 50%, transparent 64%, #7f5d1f 72%, #f5d27b 82%, #7f5d1f 92%, transparent 100%)' }, updates: { shapeKind: 'rectangle', shapeRole: 'divider', width: 470, height: 14, strokeWidth: 0, fillColor: '#d5ad54', backgroundImageUrl: 'linear-gradient(90deg, transparent 0%, #7f5d1f 8%, #f5d27b 18%, #7f5d1f 28%, transparent 36%, #d5ad54 50%, transparent 64%, #7f5d1f 72%, #f5d27b 82%, #7f5d1f 92%, transparent 100%)', borderWidth: '_none_', borderRadius: 'rounded-full', appearance: { shapeRole: 'divider' } } },
  { id: 'divider-mana-thread-seed', label: 'Mana Thread', description: 'Violet and gold energy divider rail.', kind: 'dividerRecipe', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['shape'], roles: ['divider'], surfaces: ['dividerRail'] }, preview: { background: 'linear-gradient(90deg, transparent, #7a52cc 16%, #d5ad54 50%, #7a52cc 84%, transparent)' }, updates: { shapeKind: 'rectangle', shapeRole: 'divider', width: 470, height: 10, strokeWidth: 0, fillColor: '#7a52cc', backgroundImageUrl: 'linear-gradient(90deg, transparent, #7a52cc 16%, #d5ad54 50%, #7a52cc 84%, transparent)', borderWidth: '_none_', borderRadius: 'rounded-full', appearance: { shapeRole: 'divider' } } },
  { id: 'divider-double-gold-seed', label: 'Double Gold', description: 'Two-line gold divider rail.', kind: 'dividerRecipe', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['shape'], roles: ['divider'], surfaces: ['dividerRail'] }, preview: { background: 'linear-gradient(180deg, transparent 0 25%, #d5ad54 25% 38%, transparent 38% 62%, #d5ad54 62% 75%, transparent 75%)' }, updates: { shapeKind: 'rectangle', shapeRole: 'divider', width: 470, height: 12, strokeWidth: 0, fillColor: '#d5ad54', backgroundImageUrl: 'linear-gradient(180deg, transparent 0 25%, #d5ad54 25% 38%, transparent 38% 62%, #d5ad54 62% 75%, transparent 75%)', borderWidth: '_none_', appearance: { shapeRole: 'divider' } } },
  { id: 'divider-bloodline-seed', label: 'Bloodline', description: 'Red-gold combat divider rail.', kind: 'dividerRecipe', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['shape'], roles: ['divider'], surfaces: ['dividerRail'] }, preview: { background: 'linear-gradient(90deg, transparent, #8c2718 18%, #f0b15a 50%, #8c2718 82%, transparent)' }, updates: { shapeKind: 'rectangle', shapeRole: 'divider', width: 470, height: 10, strokeWidth: 0, fillColor: '#8c2718', backgroundImageUrl: 'linear-gradient(90deg, transparent, #8c2718 18%, #f0b15a 50%, #8c2718 82%, transparent)', borderWidth: '_none_', borderRadius: 'rounded-full', appearance: { shapeRole: 'divider' } } },
  { id: 'divider-chevron-relic-seed', label: 'Chevron Relic', description: 'Chevron-styled relic divider rail.', kind: 'dividerRecipe', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['shape'], roles: ['divider'], surfaces: ['dividerRail'] }, preview: { background: 'repeating-linear-gradient(120deg, transparent 0 10px, rgba(255,255,255,0.16) 10px 15px), linear-gradient(90deg, transparent, #4d2096 14%, #d5ad54 50%, #4d2096 86%, transparent)' }, updates: { shapeKind: 'rectangle', shapeRole: 'divider', width: 470, height: 18, strokeWidth: 0, fillColor: '#7a52cc', backgroundImageUrl: 'repeating-linear-gradient(120deg, transparent 0 10px, rgba(255,255,255,0.16) 10px 15px), linear-gradient(90deg, transparent, #4d2096 14%, #d5ad54 50%, #4d2096 86%, transparent)', borderWidth: '_none_', borderRadius: 'rounded-full', appearance: { shapeRole: 'divider' } } },
  { id: 'divider-gem-center-seed', label: 'Gem Center', description: 'Centered gem divider rail.', kind: 'dividerRecipe', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['shape'], roles: ['divider'], surfaces: ['dividerRail'] }, preview: { background: 'linear-gradient(90deg, transparent, #7f5d1f 20%, transparent 42%, #f5d27b 47%, #7a52cc 50%, #f5d27b 53%, transparent 58%, #7f5d1f 80%, transparent)' }, updates: { shapeKind: 'rectangle', shapeRole: 'divider', width: 470, height: 20, strokeWidth: 0, fillColor: '#d5ad54', backgroundImageUrl: 'linear-gradient(90deg, transparent, #7f5d1f 20%, transparent 42%, #f5d27b 47%, #7a52cc 50%, #f5d27b 53%, transparent 58%, #7f5d1f 80%, transparent)', borderWidth: '_none_', borderRadius: 'rounded-full', appearance: { shapeRole: 'divider' } } },
];

export const ICON_STYLE_PRESET_RECIPES: ElementPresetRecipe[] = [
  { id: 'icon-style-fire', label: 'Fire', description: 'Fire symbol treatment.', kind: 'iconStyle', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['icon'], surfaces: ['iconGlyph', 'iconBackplate'] }, preview: { background: '#210b06', borderColor: '#d67425', iconName: 'Flame' }, updates: { iconName: 'Flame', strokeColor: '#ffb35f', fillColor: 'rgba(132,37,15,0.72)', backgroundColor: '#210b06', borderColor: '#d67425', borderWidth: 'border', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { id: 'icon-style-water', label: 'Water', description: 'Water symbol treatment.', kind: 'iconStyle', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['icon'], surfaces: ['iconGlyph', 'iconBackplate'] }, preview: { background: '#071521', borderColor: '#49a7df', iconName: 'Droplets' }, updates: { iconName: 'Droplets', strokeColor: '#9ddcff', fillColor: 'rgba(47,125,185,0.45)', backgroundColor: '#071521', borderColor: '#49a7df', borderWidth: 'border', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { id: 'icon-style-arcane', label: 'Arcane', description: 'Arcane symbol treatment.', kind: 'iconStyle', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['icon'], surfaces: ['iconGlyph', 'iconBackplate'] }, preview: { background: '#190f2c', borderColor: '#7a52cc', iconName: 'WandSparkles' }, updates: { iconName: 'WandSparkles', strokeColor: '#d8c4ff', fillColor: 'rgba(122,82,204,0.42)', backgroundColor: '#190f2c', borderColor: '#7a52cc', borderWidth: 'border-2', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { id: 'icon-style-nature', label: 'Nature', description: 'Nature symbol treatment.', kind: 'iconStyle', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['icon'], surfaces: ['iconGlyph', 'iconBackplate'] }, preview: { background: '#0b1a0f', borderColor: '#6fb06a', iconName: 'Leaf' }, updates: { iconName: 'Leaf', strokeColor: '#b9f2a1', fillColor: 'rgba(62,137,78,0.48)', backgroundColor: '#0b1a0f', borderColor: '#6fb06a', borderWidth: 'border', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { id: 'icon-style-shadow', label: 'Shadow', description: 'Shadow symbol treatment.', kind: 'iconStyle', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['icon'], surfaces: ['iconGlyph', 'iconBackplate'] }, preview: { background: '#08070a', borderColor: '#8066a8', iconName: 'Skull' }, updates: { iconName: 'Skull', strokeColor: '#e6d8ff', fillColor: 'rgba(36,28,46,0.82)', backgroundColor: '#08070a', borderColor: '#8066a8', borderWidth: 'border', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { id: 'icon-style-relic', label: 'Relic', description: 'Relic symbol treatment.', kind: 'iconStyle', contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME, status: 'published', tier: 'free', source: 'developer-pipeline', appliesTo: { elementTypes: ['icon'], surfaces: ['iconGlyph', 'iconBackplate'] }, preview: { background: '#151008', borderColor: '#d5ad54', iconName: 'Gem' }, updates: { iconName: 'Gem', strokeColor: '#ffe09b', fillColor: 'rgba(213,173,84,0.34)', backgroundColor: '#151008', borderColor: '#d5ad54', borderWidth: 'border-2', borderRadius: 'rounded-full', iconImageSource: undefined } },
];

export const createFrameKitPresetRecipes = (frameKits: CardFrameKit[]): ElementPresetRecipe[] =>
  frameKits.map((kit) => ({
    id: `frame-kit-${kit.id}`,
    label: kit.name,
    description: 'Template-canvas frame kit from the developer pipeline model.',
    kind: 'frameKit',
    contributorName: DEFAULT_OWNER_CONTRIBUTOR_NAME,
    status: 'published',
    tier: 'free',
    source: 'developer-pipeline',
    appliesTo: { elementTypes: ['template'], surfaces: ['templateCanvas'] },
    preview: { imageUrl: kit.assetUrl, background: kit.baseBackgroundColor },
    templateUpdates: getFrameKitTemplateUpdates(kit),
  }));

const appearanceKindToRecipeKind = (kind: AppearanceStylePreset['kind']): ElementPresetKind => {
  if (kind === 'shapeRole') return 'shapeRole';
  if (kind === 'frameKit' || kind === 'theme') return 'frameKit';
  if (kind === 'textFrame') return 'textFrame';
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
  librarySource: AppearanceStylePreset['librarySource'],
): ElementPresetRecipe['tier'] => {
  void librarySource;
  if (tier === 'developer' || tier === 'free' || tier === 'paid') return tier;
  return 'free';
};

export const createRecipesFromAppearanceStyles = (styles: AppearanceStylePreset[]): ElementPresetRecipe[] =>
  styles.map((style) => {
    const elementTypes = Array.from(new Set(style.targets.map(targetToElementType).filter((target): target is ElementPresetTarget => Boolean(target))));
    return {
      id: `style-${style.id}`,
      label: style.name,
      description: style.librarySource === 'developer'
        ? 'Pipeline-published appearance preset.'
        : 'Forge Pipeline starter appearance preset.',
      kind: appearanceKindToRecipeKind(style.kind),
      contributorName: style.contributorName || (style.librarySource === 'developer' ? 'Developer pipeline' : DEFAULT_OWNER_CONTRIBUTOR_NAME),
      status: appearanceStyleStatusToRecipeStatus(style.registryStatus),
      tier: appearanceStyleTierToRecipeTier(style.accessTier, style.librarySource),
      source: style.librarySource === 'developer' ? 'developer-pipeline' : 'registry-style',
      appliesTo: {
        elementTypes: elementTypes.length ? elementTypes : ['text', 'shape'],
        roles: style.targets.includes('divider') ? ['divider'] : undefined,
        surfaces: appearanceSurfacesForStyle(style),
      },
      preview: {
        background: style.appearance.material?.baseColor,
        borderColor: style.appearance.border?.color,
        imageUrl: style.appearance.dividerAsset || style.appearance.assetSource || style.appearance.material?.texture?.assetSource,
      },
      updates: style.updates,
      appearance: style.appearance,
      templateUpdates: style.templateUpdates,
    };
  });

export const mergeElementPresetRecipes = (...recipeGroups: ElementPresetRecipe[][]): ElementPresetRecipe[] => {
  const byId = new Map<string, ElementPresetRecipe>();
  const idsBySemanticKey = new Map<string, string>();

  recipeGroups.flat().forEach((recipe) => {
    const semanticKey = `${recipe.kind}:${recipe.label.trim().toLowerCase()}`;
    const existingSemanticId = idsBySemanticKey.get(semanticKey);

    if (existingSemanticId) {
      const existing = byId.get(existingSemanticId);
      if (existing?.source !== 'registry-style' && recipe.source === 'registry-style') {
        byId.delete(existingSemanticId);
        byId.set(recipe.id, recipe);
        idsBySemanticKey.set(semanticKey, recipe.id);
      }
      return;
    }

    if (byId.has(recipe.id)) return;
    byId.set(recipe.id, recipe);
    idsBySemanticKey.set(semanticKey, recipe.id);
  });

  return Array.from(byId.values());
};

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
    return {
      ...updates,
      appearance: normalizeAppearanceForElement(nextElement),
    };
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
