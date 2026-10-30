import { validateHomepageCustomSections, type HomepageCustomSection } from './homepageComposition';
import type { SiteContentGroup } from './siteContent';
import type { SiteMediaGroup, SiteMediaSlot } from './siteMedia';

/** First-party presentation only. Existing product, account and provider routes remain code-owned. */
export const RESERVED_SITE_PAGE_SLUGS = new Set([
  'about', 'accessibility', 'account', 'api', 'cameron', 'card-assets', 'contact',
  'contributor-terms', 'contributors', 'creator-pass-terms', 'integrations', 'mcp',
  'mcp-card-set-preview', 'mcp-template-preview', 'owner', 'plans', 'privacy',
  'refund', 'updates', 'roadmap', 'sign-in', 'sign-up', 'studio', 'supporter-terms', 'terms',
  'robots', 'sitemap', 'favicon', '_next', '.well-known',
]);

export interface PublicSitePage {
  id: `page-${string}`;
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  published: boolean;
  sections: HomepageCustomSection[];
}

export interface OwnerSitePageContext {
  label: string;
  contentGroups: SiteContentGroup[];
  mediaGroups: SiteMediaGroup[];
  authoredPage: PublicSitePage | null;
  mediaSlots: SiteMediaSlot[];
}

/** Keep live-edit targets aligned with the actual route rather than treating authored pages as the homepage. */
export const getOwnerSitePageContext = (
  currentPath: string,
  pages: readonly PublicSitePage[] = [],
): OwnerSitePageContext => {
  if (currentPath === '/plans') return { label: 'Plans', contentGroups: ['plans', 'shell'], mediaGroups: ['brand'], authoredPage: null, mediaSlots: [] };
  if (currentPath === '/about') return { label: 'About', contentGroups: ['about', 'shell'], mediaGroups: ['brand'], authoredPage: null, mediaSlots: [] };
  if (currentPath === '/cameron') return { label: 'Founder', contentGroups: ['founder', 'shell'], mediaGroups: ['brand', 'founder'], authoredPage: null, mediaSlots: [] };
  if (currentPath === '/contributors') return { label: 'Contributor Program', contentGroups: ['contributor', 'shell'], mediaGroups: ['brand'], authoredPage: null, mediaSlots: [] };
  if (currentPath === '/updates') return {label:'Updates',contentGroups:['shell'],mediaGroups:['brand'],authoredPage:null,mediaSlots:[]};
  if (currentPath === '/roadmap') return { label: 'Roadmap', contentGroups: ['roadmap', 'shell'], mediaGroups: ['brand'], authoredPage: null, mediaSlots: [] };

  const authoredPage = pages.find((page) => `/${page.slug}` === currentPath) ?? null;
  if (authoredPage) {
    const mediaSlots = [...new Set(authoredPage.sections.flatMap((section) => (
      section.blocks.flatMap((block) => block.kind === 'image' && block.mediaSlot ? [block.mediaSlot] : [])
    )))];
    return {
      label: authoredPage.title,
      contentGroups: ['shell'],
      mediaGroups: ['brand', 'landing', 'showcase'],
      authoredPage,
      mediaSlots,
    };
  }
  return { label: 'Homepage', contentGroups: ['landing', 'shell', 'sharing'], mediaGroups: ['brand', 'landing', 'showcase'], authoredPage: null, mediaSlots: [] };
};

/** Keep the live media picker scoped to shared brand assets and image slots used by the selected authored page. */
export const isOwnerSiteMediaTarget = (
  context: Pick<OwnerSitePageContext, 'mediaGroups' | 'authoredPage' | 'mediaSlots'>,
  asset: { group: SiteMediaGroup; slot: SiteMediaSlot },
): boolean => context.mediaGroups.includes(asset.group)
  && (!context.authoredPage || asset.group === 'brand' || context.mediaSlots.includes(asset.slot));

export const isPublicSitePageId = (value: unknown): value is PublicSitePage['id'] => (
  typeof value === 'string' && /^page-[a-z0-9][a-z0-9-]{0,33}$/u.test(value)
);
export const isPublicSitePageSlug = (value: unknown): value is string => (
  typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(value)
  && value.length <= 64 && !RESERVED_SITE_PAGE_SLUGS.has(value)
);

export const validatePublicSitePages = (value: unknown): PublicSitePage[] => {
  if (!Array.isArray(value) || value.length > 32) throw new Error('Use up to 32 first-party public pages.');
  const ids = new Set<string>();
  const slugs = new Set<string>();
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Invalid website page.');
    const row = candidate as Record<string, unknown>;
    const text = (key: string, min: number, max: number): string => {
      const item = row[key];
      if (typeof item !== 'string' || item.trim().length < min || item.trim().length > max) {
        throw new Error(`Page ${key} must be between ${min} and ${max} characters.`);
      }
      return item.trim();
    };
    if (Object.keys(row).some((key) => !['id', 'slug', 'title', 'description', 'keywords', 'published', 'sections'].includes(key))
      || !isPublicSitePageId(row.id) || !isPublicSitePageSlug(row.slug)
      || ids.has(row.id) || slugs.has(row.slug) || typeof row.published !== 'boolean'
      || !Array.isArray(row.sections) || row.sections.length < 1) {
      throw new Error('Pages need unique stable identities and unreserved paths, a publication state and validated sections.');
    }
    if (!Array.isArray(row.keywords) || row.keywords.length < 1 || row.keywords.length > 24
      || row.keywords.some((word) => typeof word !== 'string' || !word.trim() || word.trim().length > 80)) {
      throw new Error('Page search phrases must contain 1–24 phrases of up to 80 characters.');
    }
    ids.add(row.id); slugs.add(row.slug);
    return { id: row.id, slug: row.slug, title: text('title', 1, 80), description: text('description', 40, 200),
      keywords: [...new Set((row.keywords as string[]).map((word) => word.trim()))],
      published: row.published, sections: validateHomepageCustomSections(row.sections) };
  });
};

/** Missing on pre-migration settings is the only empty fallback. Corruption must never become an editable empty site. */
export const hydratePublicSitePages = (value: unknown): PublicSitePage[] => (
  value === undefined ? [] : validatePublicSitePages(value)
);

export const getSiteCompositionSections = (settings: {
  homepageSections: readonly { id: string }[];
  pages?: PublicSitePage[];
}): { id: string }[] => [...settings.homepageSections, ...(settings.pages ?? []).flatMap((page) => page.sections)];
