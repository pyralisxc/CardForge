import { revalidateTag, unstable_cache } from 'next/cache';

import { DEFAULT_SITE_MEDIA, getDefaultSiteMedia, type SiteMediaAsset } from '../model/siteMedia';
import { getSiteMedia, SiteMediaStoreError } from './siteMediaStore';

export const SITE_MEDIA_TAG = 'public:site-media';

const readCachedSiteMedia = unstable_cache(
  getSiteMedia,
  ['public-site-media'],
  { tags: [SITE_MEDIA_TAG], revalidate: 3600 },
);

export const getCachedSiteMedia = async (): Promise<SiteMediaAsset[]> => {
  try {
    return await readCachedSiteMedia();
  } catch (error) {
    // Public rendering has a checked-in availability floor. Keep strict store
    // reads for Owner operations, but never let a transient provider/JWT
    // failure make the public site or a deployment build unavailable.
    console.error('Unable to load public site media; using compiled defaults for this request.', error);
    return DEFAULT_SITE_MEDIA.map((asset) => getDefaultSiteMedia(asset.slot));
  }
};

export const revalidateSiteMediaCache = (): void => {
  try {
    revalidateTag(SITE_MEDIA_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public site media cache:', error);
    throw new SiteMediaStoreError('The image was saved, but the public cache could not be refreshed.', 503);
  }
};
