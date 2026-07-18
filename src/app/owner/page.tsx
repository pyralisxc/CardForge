import type { Metadata } from 'next';

import { PublicAuthControls } from '@/features/account/client/auth';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { OwnerConsolePage } from '@/features/owner/client';
import { PublicSiteHeader } from '@/features/public-site/client';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Owner Console',
  description: 'Control CardForge launch readiness, feature voting, contributor asset rules, legal pages, and account access mechanics.',
  path: '/owner',
  index: false,
});

export default async function OwnerPage() {
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <>
      <div className="cardforge-public">
        <PublicSiteHeader
          accountSlot={<PublicAuthControls />}
          businessIdentity={businessIdentity}
          currentPath="/owner"
        />
      </div>
      <OwnerConsolePage />
    </>
  );
}
