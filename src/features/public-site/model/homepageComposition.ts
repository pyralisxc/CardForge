import { SITE_MEDIA_SLOTS, isComposedSiteMediaSlot, type SiteMediaSlot } from './siteMedia';

/**
 * A constrained website design vocabulary. Every block is rendered by trusted
 * CardForge code; Owner content never supplies executable HTML or CSS.
 * Saved in the existing Owner homepage_sections field, not a parallel CMS.
 */
export const HOMEPAGE_COMPOSER_MEDIA_SLOTS = SITE_MEDIA_SLOTS.filter(
  (slot) => slot.startsWith('landing.') || slot === 'brand.social',
);
export const MAX_HOMEPAGE_CUSTOM_SECTIONS = 12;
export const MAX_HOMEPAGE_SECTION_BLOCKS = 12;

export type HomepageSectionLayout = 'stack' | 'split' | 'grid';
export type HomepageSectionTone = 'charcoal' | 'raised' | 'warm';
export type HomepageSectionSpacing = 'compact' | 'balanced' | 'spacious';
export type HomepageSectionAlign = 'start' | 'center';
export type HomepageBlockKind = 'heading' | 'text' | 'image' | 'button' | 'feature';

export interface HomepageSectionDesign {
  layout: HomepageSectionLayout;
  tone: HomepageSectionTone;
  spacing: HomepageSectionSpacing;
  align: HomepageSectionAlign;
}

export interface HomepageContentBlock {
  id: string;
  kind: HomepageBlockKind;
  text?: string;
  title?: string;
  body?: string;
  mediaSlot?: SiteMediaSlot;
  href?: string;
}

export interface HomepageCustomSection {
  id: string;
  kind: 'custom';
  visible: boolean;
  design: HomepageSectionDesign;
  blocks: HomepageContentBlock[];
}

export const DEFAULT_HOMEPAGE_SECTION_DESIGN: HomepageSectionDesign = {
  layout: 'stack', tone: 'charcoal', spacing: 'balanced', align: 'start',
};

const isRecord = (v: unknown): v is Record<string, unknown> => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
);
const validId = (value: unknown): value is string => (
  typeof value === 'string' && /^[a-z][a-z0-9-]{0,39}$/u.test(value)
);
const validSectionId = (value: unknown): value is string => (
  typeof value === 'string' && /^custom-[a-z0-9][a-z0-9-]{0,32}$/u.test(value)
);
const validShortText = (v: unknown, limit: number): v is string => (
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= limit
);
const validInternalRoute = (v: unknown): v is string => (
  typeof v === 'string' && v.length <= 500 && /^\/(?!\/)[a-zA-Z0-9/_-]*$/u.test(v)
);

export const isHomepageCustomSection = (section: { id: string }): section is HomepageCustomSection => (
  section.id.startsWith('custom-')
);

export const parseHomepageCustomSection = (value: unknown): HomepageCustomSection | null => {
  if (!isRecord(value) || !validSectionId(value.id) || value.kind !== 'custom'
    || typeof value.visible !== 'boolean' || !isRecord(value.design)
    || Object.keys(value).some((key) => !['id', 'kind', 'visible', 'design', 'blocks'].includes(key))) return null;
  const design = value.design;
  if (Object.keys(design).some((key) => !['layout', 'tone', 'spacing', 'align'].includes(key))
    || !['stack', 'split', 'grid'].includes(String(design.layout))
    || !['charcoal', 'raised', 'warm'].includes(String(design.tone))
    || !['compact', 'balanced', 'spacious'].includes(String(design.spacing))
    || !['start', 'center'].includes(String(design.align))) return null;
  if (!Array.isArray(value.blocks) || value.blocks.length < 1
    || value.blocks.length > MAX_HOMEPAGE_SECTION_BLOCKS) return null;

  const blocks: HomepageContentBlock[] = [];
  for (const raw of value.blocks) {
    if (!isRecord(raw) || !validId(raw.id)
      || blocks.some((block) => block.id === raw.id)
      || !['heading', 'text', 'image', 'button', 'feature'].includes(String(raw.kind))
      || Object.keys(raw).some((key) => !['id', 'kind', 'text', 'title', 'body', 'mediaSlot', 'href'].includes(key))) return null;
    const kind = raw.kind as HomepageBlockKind;
    if (kind === 'heading' && (!validShortText(raw.text, 180) || Object.keys(raw).some((key) => !['id', 'kind', 'text'].includes(key)))) return null;
    if (kind === 'text' && (!validShortText(raw.text, 1500) || Object.keys(raw).some((key) => !['id', 'kind', 'text'].includes(key)))) return null;
    if (kind === 'image' && (typeof raw.mediaSlot !== 'string'
      || !(HOMEPAGE_COMPOSER_MEDIA_SLOTS.includes(raw.mediaSlot as typeof HOMEPAGE_COMPOSER_MEDIA_SLOTS[number])
        || isComposedSiteMediaSlot(raw.mediaSlot))
      || Object.keys(raw).some((key) => !['id', 'kind', 'mediaSlot'].includes(key)))) return null;
    if (kind === 'button' && (!validShortText(raw.text, 80) || !validInternalRoute(raw.href)
      || Object.keys(raw).some((key) => !['id', 'kind', 'text', 'href'].includes(key)))) return null;
    if (kind === 'feature' && (!validShortText(raw.title, 100) || !validShortText(raw.body, 500)
      || Object.keys(raw).some((key) => !['id', 'kind', 'title', 'body'].includes(key)))) return null;
    blocks.push({ ...raw, id: raw.id, kind } as HomepageContentBlock);
  }
  return {
    id: value.id, kind: 'custom', visible: value.visible,
    design: design as unknown as HomepageSectionDesign, blocks,
  };
};

export const validateHomepageCustomSections = (value: unknown[]): HomepageCustomSection[] => {
  if (value.length > MAX_HOMEPAGE_CUSTOM_SECTIONS) {
    throw new Error(`A homepage may contain at most ${MAX_HOMEPAGE_CUSTOM_SECTIONS} custom sections.`);
  }
  const sections = value.map(parseHomepageCustomSection);
  if (sections.some((section) => !section)) {
    throw new Error('Custom website sections must use unique stable IDs, 1–12 validated content blocks, approved image slots and internal action routes. Unsupported content or CSS cannot be published.');
  }
  const validated = sections as HomepageCustomSection[];
  if (new Set(validated.map((item) => item.id)).size !== validated.length) {
    throw new Error('Custom homepage section identifiers must be unique.');
  }
  return validated;
};
