import { revalidateTag, unstable_cache } from 'next/cache';

import { DEFAULT_SITE_CONTENT_BLOCKS, type SiteContentBlock, type SiteContentGroup } from '../model/siteContent';
import { getSiteContentBlocks, PublicSiteStoreError } from './contentStore';

export const SITE_CONTENT_TAG = 'public:site-content';

const readCachedSiteContent = unstable_cache(
  getSiteContentBlocks,
  // Bump when canonical defaults or provider copy change outside the owner
  // mutation route (which normally revalidates).
  ['public-site-content', 'desk-model-v6'],
  { tags: [SITE_CONTENT_TAG], revalidate: 3600 },
);

const readPublicSiteContent = async (): Promise<SiteContentBlock[]> => {
  try {
    return await readCachedSiteContent();
  } catch (error) {
    // Keep the provider read fail-closed so a transient outage can never be
    // cached as authored truth. The public presentation may still use the
    // compiled defaults for this request, including during deployment builds.
    console.error('Unable to load public site content; using compiled defaults for this request.', error);
    return DEFAULT_SITE_CONTENT_BLOCKS;
  }
};

export const getCachedAllSiteContentBlocks = (): Promise<SiteContentBlock[]> => readPublicSiteContent();

export const getCachedSiteContentBlocks = (
  group: SiteContentGroup,
): Promise<SiteContentBlock[]> => readPublicSiteContent().then((blocks) => (
  blocks.filter((block) => block.group === group)
));

export const revalidateSiteContentCache = (): void => {
  try {
    revalidateTag(SITE_CONTENT_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public site content cache:', error);
    throw new PublicSiteStoreError('Content was saved, but the public cache could not be refreshed. Retry publishing to refresh it.', 503);
  }
};
