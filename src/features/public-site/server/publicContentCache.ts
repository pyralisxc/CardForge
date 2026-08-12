import { revalidateTag, unstable_cache } from 'next/cache';

import type { SiteContentBlock, SiteContentGroup } from '../model/siteContent';
import { getSiteContentBlocks } from './contentStore';

export const siteContentTag = (group: SiteContentGroup): string =>
  `public:site-content:${group}`;

const createGroupReader = (group: SiteContentGroup) => unstable_cache(
  async (): Promise<SiteContentBlock[]> => (
    (await getSiteContentBlocks()).filter((block) => block.group === group)
  ),
  ['public-site-content', group],
  { tags: [siteContentTag(group)], revalidate: 3600 },
);

const groupReaders: Record<SiteContentGroup, () => Promise<SiteContentBlock[]>> = {
  landing: createGroupReader('landing'),
  about: createGroupReader('about'),
  sharing: createGroupReader('sharing'),
};

export const getCachedSiteContentBlocks = (
  group: SiteContentGroup,
): Promise<SiteContentBlock[]> => groupReaders[group]();

export const revalidateSiteContentCache = (group: SiteContentGroup): void => {
  try {
    revalidateTag(siteContentTag(group), { expire: 0 });
  } catch (error) {
    console.error(`Unable to invalidate ${group} public content cache:`, error);
  }
};
