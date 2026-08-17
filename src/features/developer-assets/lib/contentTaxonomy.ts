export const CARDFORGE_SPECIALTY_SUGGESTIONS = [
  'general',
  'games',
  'marketing',
  'events',
  'education',
] as const;

export const CARDFORGE_USE_CASE_SUGGESTIONS = [
  'tcg',
  'playing-cards',
  'tarot',
  'event-poster',
  'social-post',
  'rulebook',
  'packaging',
] as const;

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

export const normalizeContentTaxonomyTags = (value: unknown): string[] => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(values.map(normalizeTaxonomyTag).filter(Boolean))].slice(0, 12);
};

export const formatContentTaxonomyTag = (value: string): string => value
  .replace(/-/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());
