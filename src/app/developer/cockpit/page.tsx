import type { Metadata } from 'next';

import { PublicAuthControls } from '@/features/account/client/auth';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { DeveloperCockpitPage } from '@/features/developer-cockpit/client';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { createPageMetadata } from '@/shared/siteMetadata';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Developer Cockpit',
  description: 'Protected CardForge workspace for asset review, campaign packages, site proposals, and owner-approved publishing.',
  path: '/developer/cockpit',
  index: false,
});

export default async function DeveloperCockpitRoute() {
  const authConfigured = isClerkServerConfigPresent();
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <CardForgeAppProviders>
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? <PublicAuthControls /> : undefined}
          businessIdentity={businessIdentity}
          currentPath="/developer/cockpit"
        />
      </div>
      <DeveloperCockpitPage />
    </CardForgeAppProviders>
  );
}
