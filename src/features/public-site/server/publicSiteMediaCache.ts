import { unstable_rethrow } from 'next/navigation';
import { resolveLiveWebsitePresentation } from './websitePresentationResolver';
import { revalidateTag } from 'next/cache';

import type { SiteMediaAsset } from '../model/siteMedia';
import { SiteMediaStoreError } from './siteMediaStore';

export const SITE_MEDIA_TAG = 'public:site-media';

export const getCachedSiteMedia = async (): Promise<SiteMediaAsset[]> => {
  try {
    return (await resolveLiveWebsitePresentation()).media;
  } catch (error) {
    unstable_rethrow(error);
    // Public rendering has a checked-in availability floor. Keep strict store
    // reads for Owner operations, but never let a transient provider/JWT
    // failure make the public site or a deployment build unavailable.
    console.error('Unable to load public site media; using compiled defaults for this request.', error);
    throw new SiteMediaStoreError('Live website presentation is unavailable.', 503);
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
