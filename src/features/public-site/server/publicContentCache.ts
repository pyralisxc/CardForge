import { revalidateTag, unstable_cache } from 'next/cache';

import type { SiteContentBlock, SiteContentGroup } from '../model/siteContent';
import { getSiteContentBlocks } from './contentStore';

export const SITE_CONTENT_TAG = 'public:site-content';

const readCachedSiteContent = unstable_cache(
  getSiteContentBlocks,
  ['public-site-content'],
  { tags: [SITE_CONTENT_TAG], revalidate: 3600 },
);

export const getCachedAllSiteContentBlocks = (): Promise<SiteContentBlock[]> => readCachedSiteContent();

export const getCachedSiteContentBlocks = (
  group: SiteContentGroup,
): Promise<SiteContentBlock[]> => readCachedSiteContent().then((blocks) => (
  blocks.filter((block) => block.group === group)
));

export const revalidateSiteContentCache = (): void => {
  try {
    revalidateTag(SITE_CONTENT_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public site content cache:', error);
  }
};
