import { unstable_rethrow } from 'next/navigation';
import { resolveLiveWebsitePresentation } from './websitePresentationResolver';
import { revalidateTag } from 'next/cache';

import { type SiteContentBlock, type SiteContentGroup } from '../model/siteContent';
import { PublicSiteStoreError } from './contentStore';

export const SITE_CONTENT_TAG = 'public:site-content';

const readPublicSiteContent = async (): Promise<SiteContentBlock[]> => {
  try {
    return (await resolveLiveWebsitePresentation()).content;
  } catch (error) {
    unstable_rethrow(error);
    // Keep the provider read fail-closed so a transient outage can never be
    // cached as authored truth. The public presentation may still use the
    // compiled defaults for this request, including during deployment builds.
    console.error('Unable to load public site content; using compiled defaults for this request.', error);
    throw new PublicSiteStoreError('Live website presentation is unavailable.', 503);
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
