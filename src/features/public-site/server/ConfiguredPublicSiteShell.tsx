import { Suspense, type ComponentProps, type ReactNode } from 'react';

import { PublicSiteShell } from '@/features/public-site/components/PublicSiteShell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server/publicSiteConfigurationCache';

type ConfiguredPublicSiteShellProps = Omit<ComponentProps<typeof PublicSiteShell>, 'siteConfiguration'> & { ownerControls?: ReactNode };

export async function ConfiguredPublicSiteShell({ ownerControls, ...props }: ConfiguredPublicSiteShellProps) {
  const siteConfiguration = await getCachedPublicSiteConfiguration();
  return <PublicSiteShell {...props} siteConfiguration={siteConfiguration}>
    {props.children}
    <Suspense fallback={null}>
      {ownerControls}
    </Suspense>
  </PublicSiteShell>;
}
