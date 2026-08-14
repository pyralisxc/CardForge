import type { ComponentProps } from 'react';

import { PublicSiteShell as PublicSiteShellView } from '@/features/public-site/components/PublicSiteShell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server/publicSiteConfigurationCache';

type PublicSiteShellProps = Omit<ComponentProps<typeof PublicSiteShellView>, 'siteConfiguration'>;

export async function PublicSiteShell(props: PublicSiteShellProps) {
  const siteConfiguration = await getCachedPublicSiteConfiguration();
  return <PublicSiteShellView {...props} siteConfiguration={siteConfiguration} />;
}
