export interface ContentTaxonomyOption {
  id: string;
  label: string;
  description: string;
}

export const CARDFORGE_SPECIALTY_OPTIONS = [
  { id: 'general', label: 'General', description: 'Broadly reusable content that is not limited to one specialty.' },
  { id: 'games', label: 'Games', description: 'Tabletop, card-game, and game-system creation.' },
  { id: 'marketing', label: 'Marketing', description: 'Promotional, campaign, brand, and launch content.' },
  { id: 'events', label: 'Events', description: 'Event-facing signage, schedules, invitations, and promotional material.' },
  { id: 'education', label: 'Education', description: 'Learning, classroom, reference, and instructional content.' },
  { id: 'business', label: 'Business', description: 'Operational, product, sales, and professional communication.' },
  { id: 'community', label: 'Community', description: 'Clubs, groups, local organizations, and community projects.' },
] as const satisfies readonly ContentTaxonomyOption[];

export const CARDFORGE_USE_CASE_OPTIONS = [
  { id: 'tcg', label: 'TCG / CCG', description: 'Trading and collectible card games.' },
  { id: 'playing-cards', label: 'Playing Cards', description: 'Poker-style, traditional, and custom playing-card decks.' },
  { id: 'tarot', label: 'Tarot / Oracle', description: 'Tarot, oracle, and divination card systems.' },
  { id: 'board-game', label: 'Board Game', description: 'Board-game cards, components, and reference pieces.' },
  { id: 'reference-card', label: 'Reference Card', description: 'Rules summaries, quick-reference cards, and game aids.' },
  { id: 'business-card', label: 'Business Card', description: 'Professional contact, networking, and business identity cards.' },
  { id: 'event-badge', label: 'Event Badge', description: 'Attendee, staff, speaker, and exhibitor identification badges.' },
  { id: 'event-poster', label: 'Event Poster', description: 'Printed or digital event promotion.' },
  { id: 'social-post', label: 'Social Post', description: 'Social-media graphics and campaign posts.' },
  { id: 'rulebook', label: 'Rulebook', description: 'Rulebook and instructional visual systems.' },
  { id: 'packaging', label: 'Packaging', description: 'Boxes, labels, inserts, and product packaging.' },
] as const satisfies readonly ContentTaxonomyOption[];

export const CARDFORGE_SPECIALTY_SUGGESTIONS = CARDFORGE_SPECIALTY_OPTIONS.map((option) => option.id);
export const CARDFORGE_USE_CASE_SUGGESTIONS = CARDFORGE_USE_CASE_OPTIONS.map((option) => option.id);

const specialtyTagSet = new Set<string>(CARDFORGE_SPECIALTY_SUGGESTIONS);
const useCaseTagSet = new Set<string>(CARDFORGE_USE_CASE_SUGGESTIONS);
const reusableResourceKinds = new Set(['textures', 'dividers', 'icons', 'imageAssets', 'elementPresets', 'fonts']);

/** General reusable resources need no invented use case; Templates and Sets do. */
export const hasRequiredPipelineClassification = (
  assetType: unknown,
  specialtyTags: readonly string[],
  useCaseTags: readonly string[],
): boolean => {
  if (typeof assetType !== 'string' || (!reusableResourceKinds.has(assetType) && assetType !== 'templates' && assetType !== 'sets')) return false;
  if (!specialtyTags.length || specialtyTags.some((tag) => !specialtyTagSet.has(tag)) || useCaseTags.some((tag) => !useCaseTagSet.has(tag))) return false;
  return useCaseTags.length > 0 || (reusableResourceKinds.has(assetType) && specialtyTags.length === 1 && specialtyTags[0] === 'general');
};
const contentTagSet = new Set<string>([
  ...CARDFORGE_SPECIALTY_SUGGESTIONS,
  ...CARDFORGE_USE_CASE_SUGGESTIONS,
]);

const normalizeTaxonomyTag = (value: unknown): string => (
  typeof value === 'string'
    ? value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
    : ''
);

const normalizeCanonicalTags = (value: unknown, allowed: Set<string>): string[] => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(values.map(normalizeTaxonomyTag).filter((tag) => allowed.has(tag)))].slice(0, 12);
};

export const normalizeSpecialtyTags = (value: unknown): string[] =>
  normalizeCanonicalTags(value, specialtyTagSet);

export const normalizeUseCaseTags = (value: unknown): string[] =>
  normalizeCanonicalTags(value, useCaseTagSet);

/**
 * Shared storage normalizer for the existing taxonomy columns. UI surfaces should
 * use the specialty/use-case-specific option lists so contributors cannot invent tags.
 */
export const normalizeContentTaxonomyTags = (value: unknown): string[] =>
  normalizeCanonicalTags(value, contentTagSet);

export const formatContentTaxonomyTag = (value: string): string => value
  .replace(/-/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

export type PipelineTaxonomyAssetType =
  | 'templates'
  | 'elementPresets'
  | 'textures'
  | 'dividers'
  | 'icons'
  | 'imageAssets'
  | 'fonts'
  | 'sets';

export const CARDFORGE_SEMANTIC_ROLE_OPTIONS = [
  { id: 'template-front', label: 'Front Template', description: 'Reusable front-face layout.', assetTypes: ['templates'] },
  { id: 'template-back', label: 'Back Template', description: 'Reusable back-face layout.', assetTypes: ['templates'] },
  { id: 'set', label: 'Set', description: 'A complete reusable or playable card Set.', assetTypes: ['sets'] },
  { id: 'picture', label: 'Picture', description: 'Primary illustrative or photographic content.', assetTypes: ['imageAssets'] },
  { id: 'foundation', label: 'Foundation', description: 'Full-area background or surface foundation.', assetTypes: ['textures', 'imageAssets'] },
  { id: 'border', label: 'Border', description: 'Transparent or structural edge treatment.', assetTypes: ['imageAssets', 'elementPresets'] },
  { id: 'frame', label: 'Frame', description: 'Structural frame surrounding content regions.', assetTypes: ['imageAssets', 'elementPresets'] },
  { id: 'text-frame', label: 'Text Frame', description: 'Panel or container designed to hold readable text.', assetTypes: ['dividers', 'imageAssets', 'elementPresets'] },
  { id: 'ornament', label: 'Ornament', description: 'Decorative corner, flourish, accent, or non-semantic embellishment.', assetTypes: ['dividers', 'icons', 'imageAssets', 'elementPresets'] },
  { id: 'divider', label: 'Divider', description: 'Separator between content regions.', assetTypes: ['dividers', 'elementPresets'] },
  { id: 'texture', label: 'Texture', description: 'Repeatable or surface-detail texture.', assetTypes: ['textures'] },
  { id: 'material', label: 'Material', description: 'Reusable material/surface treatment recipe.', assetTypes: ['textures', 'elementPresets'] },
  { id: 'icon', label: 'Icon', description: 'General-purpose pictogram or compact visual mark.', assetTypes: ['icons', 'elementPresets'] },
  { id: 'pip', label: 'Pip / Resource Symbol', description: 'Small repeated resource, suit, affinity, or value mark.', assetTypes: ['icons'] },
  { id: 'symbol', label: 'Mechanic / Type Symbol', description: 'Semantic symbol for a mechanic, type, state, or rule concept.', assetTypes: ['icons'] },
  { id: 'stat-component', label: 'Stat Component', description: 'UI-like badge, gem, counter, or stat-bearing component.', assetTypes: ['icons', 'imageAssets', 'elementPresets'] },
  { id: 'shape', label: 'Shape', description: 'Reusable structural or decorative shape.', assetTypes: ['elementPresets'] },
  { id: 'style', label: 'Style Recipe', description: 'Reusable appearance/style recipe.', assetTypes: ['elementPresets'] },
  { id: 'font', label: 'Font', description: 'Governed typography family or face.', assetTypes: ['fonts'] },
] as const satisfies readonly (ContentTaxonomyOption & {
  assetTypes: readonly PipelineTaxonomyAssetType[];
})[];

export type PipelineSemanticRole = typeof CARDFORGE_SEMANTIC_ROLE_OPTIONS[number]['id'];

const semanticRoleById = new Map<PipelineSemanticRole, typeof CARDFORGE_SEMANTIC_ROLE_OPTIONS[number]>(
  CARDFORGE_SEMANTIC_ROLE_OPTIONS.map((option) => [option.id, option]),
);

export const getSemanticRoleOptions = (
  assetType: PipelineTaxonomyAssetType,
): readonly typeof CARDFORGE_SEMANTIC_ROLE_OPTIONS[number][] => (
  CARDFORGE_SEMANTIC_ROLE_OPTIONS.filter((option) => (
    (option.assetTypes as readonly PipelineTaxonomyAssetType[]).includes(assetType)
  ))
);

export const normalizeSemanticRole = (
  value: unknown,
  assetType: unknown,
): PipelineSemanticRole | null => {
  if (typeof value !== 'string' || typeof assetType !== 'string') return null;
  const normalized = normalizeTaxonomyTag(value) as PipelineSemanticRole;
  const option = semanticRoleById.get(normalized);
  return option && (option.assetTypes as readonly string[]).includes(assetType)
    ? normalized
    : null;
};

export const hasRequiredPipelineSemanticClassification = (
  assetType: unknown,
  semanticRole: unknown,
): semanticRole is PipelineSemanticRole => normalizeSemanticRole(semanticRole, assetType) !== null;

export const CARDFORGE_VARIANT_KIND_OPTIONS = [
  { id: 'base', label: 'Base', description: 'Primary member of a visual family.' },
  { id: 'format', label: 'Format Variant', description: 'Same visual family adapted to a different physical format.' },
  { id: 'treatment', label: 'Treatment Variant', description: 'Same role/family with a distinct visual treatment.' },
  { id: 'size', label: 'Size Variant', description: 'Same concept adapted to a different working size.' },
  { id: 'color', label: 'Color Variant', description: 'Same concept with a deliberate colorway.' },
  { id: 'finish', label: 'Finish Variant', description: 'Same concept with a digital or production finish treatment.' },
] as const satisfies readonly ContentTaxonomyOption[];

export type PipelineVariantKind = typeof CARDFORGE_VARIANT_KIND_OPTIONS[number]['id'];
const variantKindSet = new Set<string>(CARDFORGE_VARIANT_KIND_OPTIONS.map((option) => option.id));

export const normalizeVariantKind = (value: unknown): PipelineVariantKind | null => {
  const normalized = normalizeTaxonomyTag(value);
  return variantKindSet.has(normalized) ? normalized as PipelineVariantKind : null;
};

export const normalizeVisualFamily = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 80);
  return normalized || null;
};

export const normalizeVariantLabel = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 80);
  return normalized || null;
};

export const CARDFORGE_COMPATIBILITY_OPTIONS = [
  { id: 'front', label: 'Front Face', description: 'Suitable for front-face composition.' },
  { id: 'back', label: 'Back Face', description: 'Suitable for back-face composition.' },
  { id: 'print', label: 'Print', description: 'Reviewed for physical-print use.' },
  { id: 'digital', label: 'Digital', description: 'Suitable for digital-only presentation or export.' },
  { id: 'full-bleed', label: 'Full Bleed', description: 'Designed to extend through trim into bleed.' },
  { id: 'transparent', label: 'Transparent Overlay', description: 'Designed to preserve transparency around its content.' },
  { id: 'tileable', label: 'Tileable', description: 'Designed for seamless repeated tiling.' },
  { id: 'recolorable', label: 'Recolorable', description: 'Designed to accept creator-controlled color changes.' },
  { id: 'small-size-legible', label: 'Small-size Legible', description: 'Reviewed to remain legible at compact card scale.' },
] as const satisfies readonly ContentTaxonomyOption[];

export type PipelineCompatibilityTag = typeof CARDFORGE_COMPATIBILITY_OPTIONS[number]['id'];
const compatibilityTagSet = new Set<string>(CARDFORGE_COMPATIBILITY_OPTIONS.map((option) => option.id));

export const normalizeCompatibilityTags = (value: unknown): PipelineCompatibilityTag[] =>
  normalizeCanonicalTags(value, compatibilityTagSet) as PipelineCompatibilityTag[];
