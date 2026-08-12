export type SiteContentBlockSlug =
  | 'landing.hero.headline'
  | 'landing.hero.body'
  | 'landing.hero.support'
  | 'about.hero.headline'
  | 'about.hero.body'
  | 'sharing.message';

export type SiteContentGroup = 'landing' | 'about' | 'sharing';

export interface SiteContentBlock {
  slug: SiteContentBlockSlug;
  group: SiteContentGroup;
  label: string;
  body: string;
  updatedAt: string | null;
}

export const DEFAULT_SITE_CONTENT_BLOCKS: SiteContentBlock[] = [
  {
    slug: 'landing.hero.headline',
    group: 'landing',
    label: 'Landing hero headline',
    body: 'Design one card. Add your list. CardForge builds the set.',
    updatedAt: null,
  },
  {
    slug: 'landing.hero.body',
    group: 'landing',
    label: 'Landing hero body',
    body: 'Make the look once, add the words and pictures for each card, and watch the whole set come together. Try it in your browser and keep your work on your device.',
    updatedAt: null,
  },
  {
    slug: 'landing.hero.support',
    group: 'landing',
    label: 'Landing hero support line',
    body: 'Build the card once. Let the set follow.',
    updatedAt: null,
  },
  {
    slug: 'about.hero.headline',
    group: 'about',
    label: 'About page headline',
    body: 'Give everyday creators room to make it their own.',
    updatedAt: null,
  },
  {
    slug: 'about.hero.body',
    group: 'about',
    label: 'About page body',
    body: 'CardForge Studio turns a reusable design and structured content into a consistent set without taking the creative decisions away from you. It is built for people who want deep customization without rebuilding every item by hand.',
    updatedAt: null,
  },
  {
    slug: 'sharing.message',
    group: 'sharing',
    label: 'Share message',
    body: 'Check out CardForge Studio—a friendly way to design one card and build the whole set.',
    updatedAt: null,
  },
];

const siteContentSlugs = new Set<SiteContentBlockSlug>(
  DEFAULT_SITE_CONTENT_BLOCKS.map((block) => block.slug),
);

export type SiteContentBlockInputResult =
  | { ok: true; value: { slug: SiteContentBlockSlug; body: string } }
  | { ok: false; message: string };

export const normalizeSiteContentBlockInput = (value: {
  slug?: unknown;
  body?: unknown;
}): SiteContentBlockInputResult => {
  const slug = typeof value.slug === 'string' ? value.slug : '';
  if (!siteContentSlugs.has(slug as SiteContentBlockSlug)) {
    return { ok: false, message: 'Unknown site copy block.' };
  }

  const body = typeof value.body === 'string' ? value.body.trim() : '';
  if (!body) return { ok: false, message: 'Site copy is required.' };
  if (body.length > 800) return { ok: false, message: 'Site copy must be 800 characters or fewer.' };

  return { ok: true, value: { slug: slug as SiteContentBlockSlug, body } };
};

export const getDefaultSiteContentBlock = (slug: SiteContentBlockSlug): SiteContentBlock =>
  DEFAULT_SITE_CONTENT_BLOCKS.find((block) => block.slug === slug) ?? DEFAULT_SITE_CONTENT_BLOCKS[0];

export const createSiteContentMap = (
  blocks: SiteContentBlock[],
): Record<SiteContentBlockSlug, string> => Object.fromEntries(
  DEFAULT_SITE_CONTENT_BLOCKS.map((defaultBlock) => {
    const block = blocks.find((candidate) => candidate.slug === defaultBlock.slug);
    return [defaultBlock.slug, block?.body || defaultBlock.body];
  }),
) as Record<SiteContentBlockSlug, string>;
