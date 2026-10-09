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


export const CARDFORGE_SEMANTIC_ROLE_OPTIONS = [
  { id: 'template-front', label: 'Front Template', description: 'Reusable editable layout intended for the front face of cards.' },
  { id: 'template-back', label: 'Back Template', description: 'Reusable editable layout intended for a shared or per-card reverse.' },
  { id: 'set', label: 'Set', description: 'Portable multi-card CardForge Set or starter project.' },
  { id: 'artwork', label: 'Artwork', description: 'Primary illustrative or photographic card imagery.' },
  { id: 'surface-texture', label: 'Surface Texture', description: 'Repeatable or scalable visual surface treatment.' },
  { id: 'material', label: 'Material', description: 'Reusable material/appearance recipe rather than a standalone image.' },
  { id: 'foundation', label: 'Foundation', description: 'Full-card or large-area visual foundation behind other authored elements.' },
  { id: 'border', label: 'Border / Frame', description: 'Reusable edge/frame treatment defining a card or panel boundary.' },
  { id: 'text-frame', label: 'Text Frame', description: 'Container intended to hold rules, title, flavor, or other text.' },
  { id: 'title-plate', label: 'Title Plate', description: 'Compact title/name container distinct from a separator.' },
  { id: 'divider', label: 'Divider', description: 'Separator between content regions.' },
  { id: 'icon', label: 'General Icon', description: 'General-purpose compact symbol that is not a gameplay-specific pip or mechanic mark.' },
  { id: 'resource-pip', label: 'Resource / Affinity Pip', description: 'Small gameplay symbol for cost, element, affinity, faction, or resource.' },
  { id: 'mechanic-symbol', label: 'Mechanic Symbol', description: 'Small gameplay symbol for rules, type, status, timing, targeting, or zone semantics.' },
  { id: 'ornament', label: 'Ornament', description: 'Decorative flourish, corner treatment, or embellishment.' },
  { id: 'badge', label: 'Badge / Emblem', description: 'Compact identifying emblem or labeled badge.' },
  { id: 'stat-component', label: 'Stat Component', description: 'Visual component intended to hold or emphasize a numeric/stat value.' },
  { id: 'shape', label: 'Shape', description: 'Reusable authored geometric shape or structural primitive.' },
  { id: 'style-recipe', label: 'Style Recipe', description: 'Reusable appearance recipe for another semantic element rather than a standalone visual asset.' },
  { id: 'font', label: 'Font', description: 'Governed user-facing typeface family or face.' },
] as const satisfies readonly ContentTaxonomyOption[];

export type PipelineSemanticRole = typeof CARDFORGE_SEMANTIC_ROLE_OPTIONS[number]['id'];

export const CARDFORGE_VARIANT_KIND_OPTIONS = [
  { id: 'format', label: 'Physical format', description: 'Same visual family adapted to another physical card format or size.' },
  { id: 'treatment', label: 'Treatment', description: 'Same semantic asset in a different visual treatment such as flat, engraved, neon, or foil-like.' },
  { id: 'orientation', label: 'Orientation', description: 'Portrait/landscape or comparable orientation-specific variant.' },
  { id: 'color', label: 'Color', description: 'Colorway variant of the same semantic asset.' },
  { id: 'size', label: 'Size', description: 'Size-optimized variant of the same semantic asset.' },
] as const satisfies readonly ContentTaxonomyOption[];

export type PipelineVariantKind = typeof CARDFORGE_VARIANT_KIND_OPTIONS[number]['id'];

export const CARDFORGE_COMPATIBILITY_OPTIONS = [
  { id: 'front', label: 'Front', description: 'Appropriate for front-face composition.' },
  { id: 'back', label: 'Back', description: 'Appropriate for reverse/back-face composition.' },
  { id: 'portrait', label: 'Portrait', description: 'Designed for portrait orientation.' },
  { id: 'landscape', label: 'Landscape', description: 'Designed for landscape orientation.' },
  { id: 'recolorable', label: 'Recolorable', description: 'Designed to accept creator color changes without losing meaning.' },
  { id: 'monochrome', label: 'Monochrome', description: 'Designed to work as a one-color or single-ink asset.' },
  { id: 'seamless', label: 'Seamless', description: 'Can tile without a visible seam.' },
  { id: 'small-size', label: 'Small-size legible', description: 'Reviewed for compact card-size use.' },
  { id: 'full-bleed', label: 'Full bleed', description: 'Intended to reach the physical bleed boundary.' },
  { id: 'poker', label: 'Poker size', description: 'Compatible with CardForge poker-size card geometry.' },
  { id: 'bridge', label: 'Bridge size', description: 'Compatible with CardForge bridge-size card geometry.' },
  { id: 'tarot', label: 'Tarot size', description: 'Compatible with CardForge tarot-size card geometry.' },
  { id: 'business-card', label: 'Business card', description: 'Compatible with the CardForge business-card format.' },
  { id: 'event-badge', label: 'Event badge', description: 'Compatible with the CardForge event-badge format.' },
  { id: 'reference-card', label: 'Reference card', description: 'Compatible with CardForge reference-card layouts.' },
] as const satisfies readonly ContentTaxonomyOption[];

export type PipelineCompatibilityTag = typeof CARDFORGE_COMPATIBILITY_OPTIONS[number]['id'];

const semanticRolesByAssetType: Record<string, readonly PipelineSemanticRole[]> = {
  templates: ['template-front', 'template-back'],
  sets: ['set'],
  textures: ['surface-texture', 'foundation', 'artwork'],
  dividers: ['divider', 'title-plate', 'text-frame', 'border'],
  icons: ['icon', 'resource-pip', 'mechanic-symbol', 'ornament', 'badge', 'stat-component'],
  imageAssets: ['artwork', 'foundation', 'border', 'text-frame', 'ornament', 'badge'],
  elementPresets: ['material', 'foundation', 'border', 'text-frame', 'shape', 'style-recipe'],
  fonts: ['font'],
};

const semanticRoleSet = new Set<string>(CARDFORGE_SEMANTIC_ROLE_OPTIONS.map((option) => option.id));
const variantKindSet = new Set<string>(CARDFORGE_VARIANT_KIND_OPTIONS.map((option) => option.id));
const compatibilityTagSet = new Set<string>(CARDFORGE_COMPATIBILITY_OPTIONS.map((option) => option.id));

export const getDefaultPipelineSemanticRole = (
  assetType: unknown,
  studioDestination?: unknown,
): PipelineSemanticRole | null => {
  if (assetType === 'templates') return studioDestination === 'template.back' ? 'template-back' : 'template-front';
  if (assetType === 'sets') return 'set';
  if (assetType === 'textures') return 'surface-texture';
  if (assetType === 'dividers') return 'divider';
  if (assetType === 'icons') return 'icon';
  if (assetType === 'imageAssets') {
    if (studioDestination === 'image.border.front' || studioDestination === 'image.border.back') return 'border';
    if (studioDestination === 'image.frame.front' || studioDestination === 'image.frame.back') return 'foundation';
    return 'artwork';
  }
  if (assetType === 'elementPresets') {
    if (studioDestination === 'style.material') return 'material';
    if (studioDestination === 'style.border') return 'border';
    if (studioDestination === 'style.textFrame') return 'text-frame';
    if (studioDestination === 'style.shape') return 'shape';
    return 'style-recipe';
  }
  if (assetType === 'fonts') return 'font';
  return null;
};

export const getPipelineSemanticRoleOptions = (
  assetType: unknown,
): readonly (typeof CARDFORGE_SEMANTIC_ROLE_OPTIONS)[number][] => {
  const allowed = typeof assetType === 'string' ? semanticRolesByAssetType[assetType] ?? [] : [];
  const allowedSet = new Set<string>(allowed);
  return CARDFORGE_SEMANTIC_ROLE_OPTIONS.filter((option) => allowedSet.has(option.id));
};

export const normalizePipelineSemanticRole = (
  value: unknown,
  assetType?: unknown,
): PipelineSemanticRole | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!semanticRoleSet.has(normalized)) return null;
  if (assetType !== undefined) {
    const allowed = typeof assetType === 'string' ? semanticRolesByAssetType[assetType] ?? [] : [];
    if (!allowed.includes(normalized as PipelineSemanticRole)) return null;
  }
  return normalized as PipelineSemanticRole;
};

export const normalizePipelineVisualFamily = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || null;
};

export const normalizePipelineVariantAssetId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, 160);
  return normalized && /^[a-zA-Z0-9._:-]+$/u.test(normalized) ? normalized : null;
};

export const normalizePipelineVariantKind = (value: unknown): PipelineVariantKind | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return variantKindSet.has(normalized) ? normalized as PipelineVariantKind : null;
};

export const normalizePipelineCompatibilityTags = (value: unknown): PipelineCompatibilityTag[] =>
  normalizeCanonicalTags(value, compatibilityTagSet) as PipelineCompatibilityTag[];

export const hasRequiredSemanticTaxonomy = ({
  assetType,
  semanticRole,
  variantOfAssetId,
  variantKind,
}: {
  assetType: unknown;
  semanticRole: unknown;
  variantOfAssetId?: unknown;
  variantKind?: unknown;
}): boolean => {
  if (!normalizePipelineSemanticRole(semanticRole, assetType)) return false;
  const parent = normalizePipelineVariantAssetId(variantOfAssetId);
  const kind = normalizePipelineVariantKind(variantKind);
  return Boolean(parent) === Boolean(kind);
};

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