import type { Metadata } from 'next';

import { AccountProfilePage } from '@/features/account/client/profile';
import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Account',
  description: 'Manage CardForge account access, local asset library status, clean export entitlement, and role-specific forge links.',
  path: '/account',
  index: false,
});

export default async function AccountPage() {
  const { authConfigured, ownerAccess } = await getCurrentCardforgeUserAccess();
  return (
    <>
      <PublicSiteHeader currentPath="/account" showOwnerLink={ownerAccess.isOwner} />
      <AccountProfilePage initialAuthConfigured={authConfigured} />
    </>
  );
}
