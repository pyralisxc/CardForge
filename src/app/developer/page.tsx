import type { Metadata } from 'next';

import { PublicAuthControls } from '@/features/account/client/auth';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { DeveloperProgramPage } from '@/features/developer-assets/client/program';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';
import { createBreadcrumbStructuredData, StructuredData } from '@/features/public-site/server';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Developer Program',
  description: 'Explore CardForge contribution standards, the application path, and the planned developer program for shared creation tools.',
  path: '/developer',
});

export default async function DeveloperPage() {
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <CardForgeAppProviders>
      <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/developer">
        <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
          { name: 'Home', path: '/' },
          { name: 'Developers', path: '/developer' },
        ])} />
        <DeveloperProgramPage initialAuthConfigured={isClerkServerConfigPresent()} supportEmail={businessIdentity.supportEmail} />
      </PublicSiteShell>
    </CardForgeAppProviders>
  );
}
