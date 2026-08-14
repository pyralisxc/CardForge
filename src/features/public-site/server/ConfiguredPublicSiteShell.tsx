import type { ComponentProps } from 'react';

import { PublicSiteShell } from '@/features/public-site/components/PublicSiteShell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server/publicSiteConfigurationCache';

type ConfiguredPublicSiteShellProps = Omit<ComponentProps<typeof PublicSiteShell>, 'siteConfiguration'>;

export async function ConfiguredPublicSiteShell(props: ConfiguredPublicSiteShellProps) {
  const siteConfiguration = await getCachedPublicSiteConfiguration();
  return <PublicSiteShell {...props} siteConfiguration={siteConfiguration} />;
}
