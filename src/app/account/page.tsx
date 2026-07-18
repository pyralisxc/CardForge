import type { Metadata } from 'next';

import { AccountProfilePage } from '@/features/account/client/profile';
import { PublicAuthControls } from '@/features/account/client/auth';
import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteHeader } from '@/features/public-site/client';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Account',
  description: 'Manage CardForge account access, local asset library status, clean export entitlement, and role-specific forge links.',
  path: '/account',
  index: false,
});

export default async function AccountPage() {
  const [{ authConfigured }, businessIdentity] = await Promise.all([
    getCurrentCardforgeUserAccess(),
    getCachedBusinessIdentity(),
  ]);
  return (
    <>
      <div className="cardforge-public">
        <PublicSiteHeader
          accountSlot={<PublicAuthControls />}
          businessIdentity={businessIdentity}
          currentPath="/account"
        />
      </div>
      <AccountProfilePage initialAuthConfigured={authConfigured} />
    </>
  );
}
