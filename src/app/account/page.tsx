import type { Metadata } from 'next';

import { AccountProfilePage } from '@/features/account/client/profile';
import { DeveloperPublicAuthControls } from '@/features/developer-access/client';
import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Account',
  description: 'Manage your CardForge account and access.',
  path: '/account',
  index: false,
});

export default async function AccountPage() {
  const [{ authConfigured }, businessIdentity, siteConfiguration] = await Promise.all([
    getCurrentCardforgeUserAccess(),
    getCachedBusinessIdentity(),
    getCachedPublicSiteConfiguration(),
  ]);
  return (
    <CardForgeAppProviders>
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? <DeveloperPublicAuthControls /> : undefined}
          businessIdentity={businessIdentity}
          currentPath="/account"
          siteConfiguration={siteConfiguration}
        />
      </div>
      <AccountProfilePage initialAuthConfigured={authConfigured} />
    </CardForgeAppProviders>
  );
}
