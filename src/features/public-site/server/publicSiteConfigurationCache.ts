import { revalidateTag, unstable_cache } from 'next/cache';

import { getPublicSiteConfiguration } from './siteConfigurationStore';

export const PUBLIC_SITE_CONFIGURATION_TAG = 'public:site-configuration';

export const getCachedPublicSiteConfiguration = unstable_cache(
  getPublicSiteConfiguration,
  ['public-site-configuration'],
  { tags: [PUBLIC_SITE_CONFIGURATION_TAG], revalidate: 3600 },
);

export const revalidatePublicSiteConfiguration = (): void => {
  try {
    revalidateTag(PUBLIC_SITE_CONFIGURATION_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public site configuration cache:', error);
  }
};
