import { revalidateTag, unstable_cache } from 'next/cache';

import type { SiteMediaAsset } from '../model/siteMedia';
import { getSiteMedia } from './siteMediaStore';

export const SITE_MEDIA_TAG = 'public:site-media';

const readCachedSiteMedia = unstable_cache(
  getSiteMedia,
  ['public-site-media'],
  { tags: [SITE_MEDIA_TAG], revalidate: 3600 },
);

export const getCachedSiteMedia = (): Promise<SiteMediaAsset[]> => readCachedSiteMedia();

export const revalidateSiteMediaCache = (): void => {
  try {
    revalidateTag(SITE_MEDIA_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public site media cache:', error);
  }
};
