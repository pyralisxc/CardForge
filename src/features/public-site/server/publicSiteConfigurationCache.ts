import { resolveLiveWebsitePresentation } from './websitePresentationResolver';
import { revalidateTag } from 'next/cache';

import { PublicSiteConfigurationStoreError } from './siteConfigurationStore';
import { completePublicSiteConfiguration, projectPublicSiteConfiguration } from '../model/siteConfiguration';

export const PUBLIC_SITE_CONFIGURATION_TAG = 'public:site-configuration';

export const getCachedPublicSiteConfiguration = async () => {
  try {
    return projectPublicSiteConfiguration(completePublicSiteConfiguration((await resolveLiveWebsitePresentation()).configuration));
  } catch (error) {
    console.error('Unable to load public site configuration; using compiled defaults for this request.', error);
    throw new PublicSiteConfigurationStoreError('Live website presentation is unavailable.', 503);
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
