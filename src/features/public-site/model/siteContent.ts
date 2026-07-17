export type SiteContentBlockSlug =
  | 'landing.hero.headline'
  | 'landing.hero.body'
  | 'landing.hero.support'
  | 'landing.demo.heading'
  | 'landing.demo.body'
  | 'about.hero.headline'
  | 'about.hero.body'
  | 'access.hero.headline'
  | 'access.hero.body'
  | 'access.creatorPool.note';

export type SiteContentGroup = 'landing' | 'about' | 'access';

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
    body: 'Build card systems, not single cards.',
    updatedAt: null,
  },
  {
    slug: 'landing.hero.body',
    group: 'landing',
    label: 'Landing hero body',
    body: 'Design one card, add your list, and let CardForge build the rest of the set.',
    updatedAt: null,
  },
  {
    slug: 'landing.hero.support',
    group: 'landing',
    label: 'Landing hero support line',
    body: 'See every card together, fix anything that looks odd, and download the finished set when it feels right.',
    updatedAt: null,
  },
  {
    slug: 'landing.demo.heading',
    group: 'landing',
    label: 'Landing demo-seat headline',
    body: 'Free demo seats are open for the current wave.',
    updatedAt: null,
  },
  {
    slug: 'landing.demo.body',
    group: 'landing',
    label: 'Landing demo-seat body',
    body: 'Claim a Founder Beta seat while there is room and try clean downloads during the beta period.',
    updatedAt: null,
  },
  {
    slug: 'about.hero.headline',
    group: 'about',
    label: 'About page headline',
    body: 'Make one card. Build the whole set.',
    updatedAt: null,
  },
  {
    slug: 'about.hero.body',
    group: 'about',
    label: 'About page body',
    body: 'Create the shared look once, add what changes from card to card, and keep the whole set together in one friendly workspace.',
    updatedAt: null,
  },
  {
    slug: 'access.hero.headline',
    group: 'access',
    label: 'Access page headline',
    body: 'Try CardForge first. Subscribe when it earns a place in your work.',
    updatedAt: null,
  },
  {
    slug: 'access.hero.body',
    group: 'access',
    label: 'Access page body',
    body: 'Open the Studio for free, claim a beta seat when one is open, or choose Creator Pass when you want clean downloads and want to support the business.',
    updatedAt: null,
  },
  {
    slug: 'access.creatorPool.note',
    group: 'access',
    label: 'Access creator-pool note',
    body: 'The older Creator Pool idea is not an active payment or profit-sharing program.',
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
