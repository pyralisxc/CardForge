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
    body: 'CardForge is the full production studio for reusable templates, structured card data, bulk generation, and clean export-ready sets.',
    updatedAt: null,
  },
  {
    slug: 'landing.hero.support',
    group: 'landing',
    label: 'Landing hero support line',
    body: 'Most card makers stop at a single design. CardForge takes creators from template to full set to proofed PNG, PDF, ZIP, and Tabletop-ready files.',
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
    body: 'Claiming a Founder Beta seat unlocks clean export access for the demo window while seats remain open. It is the fastest way to test the production workflow before CardForge moves into wider paid access.',
    updatedAt: null,
  },
  {
    slug: 'about.hero.headline',
    group: 'about',
    label: 'About page headline',
    body: 'The serious production studio behind the CardForge name.',
    updatedAt: null,
  },
  {
    slug: 'about.hero.body',
    group: 'about',
    label: 'About page body',
    body: 'CardForge helps creators design reusable card systems, generate complete sets from structured data, and export clean files. The forge theme gives the product a memorable doorway; the deeper promise is a practical production workbench for creators who need repeatable layouts, shared assets, proofing, and faster iteration.',
    updatedAt: null,
  },
  {
    slug: 'access.hero.headline',
    group: 'access',
    label: 'Access page headline',
    body: 'Start free, claim a demo seat, then unlock cleaner production workflows.',
    updatedAt: null,
  },
  {
    slug: 'access.hero.body',
    group: 'access',
    label: 'Access page body',
    body: 'CardForge is in beta, so access is intentionally staged. New users can explore the studio first, claim Founder Beta access when seats are open, and move toward Creator Pass or developer participation as the platform matures.',
    updatedAt: null,
  },
  {
    slug: 'access.creatorPool.note',
    group: 'access',
    label: 'Access creator-pool note',
    body: 'Developer profit-sharing language is a future creator-pool plan, not active payout infrastructure yet.',
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
