import type { Metadata } from 'next';

import { AccountProfilePage } from '@/features/account/client/profile';
import { PublicAuthControls } from '@/features/account/client/auth';
import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Account',
  description: 'Manage your CardForge account and access.',
  path: '/account',
  index: false,
});

export default async function AccountPage() {
  const [{ authConfigured }, businessIdentity] = await Promise.all([
    getCurrentCardforgeUserAccess(),
    getCachedBusinessIdentity(),
  ]);
  return (
    <CardForgeAppProviders>
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? <PublicAuthControls /> : undefined}
          businessIdentity={businessIdentity}
          currentPath="/account"
        />
      </div>
      <AccountProfilePage initialAuthConfigured={authConfigured} />
    </CardForgeAppProviders>
  );
}
