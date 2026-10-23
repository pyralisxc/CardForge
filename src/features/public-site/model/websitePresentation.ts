import { assertSiteConfigurationBudget, normalizePublicSiteConfigurationInput, type PublicSiteConfiguration } from './siteConfiguration';
import { normalizeSiteContentBlockInput, type SiteContentBlock, type SiteContentBlockSlug } from './siteContent';
import { getDefaultSiteMedia, isSiteMediaSlot, normalizeSiteMediaPresentation, type SiteMediaAsset, type SiteMediaSlot } from './siteMedia';

/**
 * Versioned website-presentation value. Domain authorities (identity, legal,
 * pricing, accounts, roadmap votes and provider connections) never enter it.
 * Revision identity and activation identity are deliberately separate.
 */
export const WEBSITE_PRESENTATION_SCHEMA_VERSION = 1 as const;
export const MAX_WEBSITE_PRESENTATION_BYTES = 240 * 1024;

export type WebsiteMediaReference = Pick<
  SiteMediaAsset, 'slot' | 'storagePath' | 'alt' | 'width' | 'height' | 'presentation'
> & {
  /** Digest of the exact stored bytes; immutable storage is required when non-null. */
  sha256: string | null;
};

export interface WebsitePresentationManifest {
  schemaVersion: typeof WEBSITE_PRESENTATION_SCHEMA_VERSION;
  configuration: PublicSiteConfiguration;
  content: Pick<SiteContentBlock, 'slug' | 'body'>[];
  media: WebsiteMediaReference[];
}

export class WebsitePresentationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebsitePresentationValidationError';
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const keysOnly = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

const digestPattern = /^[a-f0-9]{64}$/u;
const storagePathPattern = /^(?:brand|landing|founder)\/[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/u;

export const validateWebsitePresentationManifest = (input: unknown): WebsitePresentationManifest => {
  if (!record(input) || !keysOnly(input, ['schemaVersion', 'configuration', 'content', 'media'])) {
    throw new WebsitePresentationValidationError('Invalid website presentation manifest.');
  }
  if (input.schemaVersion !== WEBSITE_PRESENTATION_SCHEMA_VERSION) {
    throw new WebsitePresentationValidationError('This website revision needs an explicit compatibility upgrade before use.');
  }
  if (!record(input.configuration) || !Array.isArray(input.content) || !Array.isArray(input.media)) {
    throw new WebsitePresentationValidationError('Website revision content is incomplete.');
  }
  let configuration: PublicSiteConfiguration;
  try {
    configuration = normalizePublicSiteConfigurationInput(input.configuration);
    assertSiteConfigurationBudget(configuration);
  } catch (error) {
    throw new WebsitePresentationValidationError(error instanceof Error ? error.message : 'Invalid website configuration.');
  }
  const content: WebsitePresentationManifest['content'] = [];
  const seenSlugs = new Set<string>();
  for (const block of input.content) {
    if (!record(block) || !keysOnly(block, ['slug', 'body'])) {
      throw new WebsitePresentationValidationError('Invalid site-copy block.');
    }
    const result = normalizeSiteContentBlockInput(block);
    if (!result.ok || seenSlugs.has(String(block.slug))) {
      throw new WebsitePresentationValidationError('Website copy contains an invalid or duplicate block.');
    }
    seenSlugs.add(result.value.slug);
    content.push({ slug: result.value.slug as SiteContentBlockSlug, body: result.value.body });
  }
  const media: WebsiteMediaReference[] = [];
  const seenSlots = new Set<string>();
  for (const item of input.media) {
    if (!record(item) || !keysOnly(item, ['slot', 'storagePath', 'alt', 'width', 'height', 'presentation', 'sha256'])
      || !isSiteMediaSlot(item.slot) || seenSlots.has(item.slot)) {
      throw new WebsitePresentationValidationError('Invalid or duplicate website media slot.');
    }
    seenSlots.add(item.slot);
    const slot = item.slot as SiteMediaSlot;
    const path = item.storagePath;
    const sha = item.sha256;
    if ((path !== null && (typeof path !== 'string' || !storagePathPattern.test(path)))
      || (path === null && sha !== null)
      || (path !== null && (typeof sha !== 'string' || !digestPattern.test(sha)))) {
      throw new WebsitePresentationValidationError('Website media must pin exact verified storage bytes.');
    }
    if (typeof item.alt !== 'string' || item.alt.length > 500
      || (item.width !== null && (!Number.isInteger(item.width) || (item.width as number) <= 0 || (item.width as number) > 20000))
      || (item.height !== null && (!Number.isInteger(item.height) || (item.height as number) <= 0 || (item.height as number) > 20000))) {
      throw new WebsitePresentationValidationError('Website media description or dimensions are invalid.');
    }
    const presentation = normalizeSiteMediaPresentation(slot, item.presentation);
    if (!presentation.ok) throw new WebsitePresentationValidationError('Website media presentation is invalid.');
    media.push({
      slot, storagePath: path as string | null, sha256: sha as string | null,
      alt: item.alt, width: item.width as number | null, height: item.height as number | null,
      presentation: presentation.value,
    });
  }
  const manifest = { schemaVersion: WEBSITE_PRESENTATION_SCHEMA_VERSION, configuration, content, media };
  if (new TextEncoder().encode(JSON.stringify(manifest)).length > MAX_WEBSITE_PRESENTATION_BYTES) {
    throw new WebsitePresentationValidationError('Website presentation exceeds the 240 KiB editable configuration budget.');
  }
  return manifest;
};

/** Reject missing historical dependencies rather than silently substitute today's slot. */
export const assertWebsiteMediaReferencesPresent = (
  manifest: WebsitePresentationManifest,
  available: ReadonlyMap<string, string>,
): void => {
  for (const ref of manifest.media) {
    if (ref.storagePath && available.get(ref.storagePath) !== ref.sha256) {
      throw new WebsitePresentationValidationError('A historical website image is unavailable or does not match its saved bytes.');
    }
  }
};

/** A revision is a value, not a live settings row; metadata cannot flow into the editable input. */
export const websiteManifestFromPublished = (input: {
  configuration: PublicSiteConfiguration;
  content: SiteContentBlock[];
  media: WebsiteMediaReference[];
}): WebsitePresentationManifest => validateWebsitePresentationManifest({
  schemaVersion: WEBSITE_PRESENTATION_SCHEMA_VERSION,
  configuration: input.configuration,
  content: input.content.map(({ slug, body }) => ({ slug, body })),
  media: input.media,
});
