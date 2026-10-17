import { revalidateTag, unstable_cache } from 'next/cache';

import { getPublicSiteConfiguration, PublicSiteConfigurationStoreError } from './siteConfigurationStore';
import { completePublicSiteConfiguration, DEFAULT_PUBLIC_SITE_CONFIGURATION, projectPublicSiteConfiguration } from '../model/siteConfiguration';

export const PUBLIC_SITE_CONFIGURATION_TAG = 'public:site-configuration';

const readCachedPublicSiteConfiguration = unstable_cache(
  getPublicSiteConfiguration,
  // Keep provider-migrated launch settings from inheriting an older deploy's
  // persistent Data Cache entry.
  ['public-site-configuration', 'first-party-pages-v3'],
  { tags: [PUBLIC_SITE_CONFIGURATION_TAG], revalidate: 3600 },
);

export const getCachedPublicSiteConfiguration = async () => {
  try {
    return projectPublicSiteConfiguration(completePublicSiteConfiguration(await readCachedPublicSiteConfiguration()));
  } catch (error) {
    console.error('Unable to load public site configuration; using compiled defaults for this request.', error);
    return completePublicSiteConfiguration(DEFAULT_PUBLIC_SITE_CONFIGURATION);
  }
};

export const revalidatePublicSiteConfiguration = (): void => {
  try {
    revalidateTag(PUBLIC_SITE_CONFIGURATION_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public site configuration cache:', error);
    throw new PublicSiteConfigurationStoreError('Settings were saved, but the public cache could not be refreshed. Retry saving to refresh it.', 503);
  }
};
