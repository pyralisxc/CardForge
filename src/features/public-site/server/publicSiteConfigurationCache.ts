import { revalidateTag, unstable_cache } from 'next/cache';

import { getPublicSiteConfiguration } from './siteConfigurationStore';
import { completePublicSiteConfiguration } from '../model/siteConfiguration';

export const PUBLIC_SITE_CONFIGURATION_TAG = 'public:site-configuration';

const readCachedPublicSiteConfiguration = unstable_cache(
  getPublicSiteConfiguration,
  // Keep provider-migrated launch settings from inheriting an older deploy's
  // persistent Data Cache entry.
  ['public-site-configuration', 'desk-model-v2'],
  { tags: [PUBLIC_SITE_CONFIGURATION_TAG], revalidate: 3600 },
);

export const getCachedPublicSiteConfiguration = () => readCachedPublicSiteConfiguration()
  .then(completePublicSiteConfiguration);

export const revalidatePublicSiteConfiguration = (): void => {
  try {
    revalidateTag(PUBLIC_SITE_CONFIGURATION_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public site configuration cache:', error);
  }
};
