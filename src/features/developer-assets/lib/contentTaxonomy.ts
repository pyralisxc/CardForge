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
  { id: 'event-poster', label: 'Event Poster', description: 'Printed or digital event promotion.' },
  { id: 'social-post', label: 'Social Post', description: 'Social-media graphics and campaign posts.' },
  { id: 'rulebook', label: 'Rulebook', description: 'Rulebook and instructional visual systems.' },
  { id: 'packaging', label: 'Packaging', description: 'Boxes, labels, inserts, and product packaging.' },
] as const satisfies readonly ContentTaxonomyOption[];

export const CARDFORGE_SPECIALTY_SUGGESTIONS = CARDFORGE_SPECIALTY_OPTIONS.map((option) => option.id);
export const CARDFORGE_USE_CASE_SUGGESTIONS = CARDFORGE_USE_CASE_OPTIONS.map((option) => option.id);

const specialtyTagSet = new Set<string>(CARDFORGE_SPECIALTY_SUGGESTIONS);
const useCaseTagSet = new Set<string>(CARDFORGE_USE_CASE_SUGGESTIONS);
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
