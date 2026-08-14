import type { Metadata } from 'next';

import { PublicAuthControls } from '@/features/account/client/auth';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { OwnerConsolePage } from '@/features/owner/client';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { createPageMetadata } from '@/shared/siteMetadata';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Owner Console',
  description: 'Control CardForge launch readiness, feature voting, contributor asset rules, legal pages, and account access mechanics.',
  path: '/owner',
  index: false,
});

export default async function OwnerPage() {
  const authConfigured = isClerkServerConfigPresent();
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <CardForgeAppProviders>
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? <PublicAuthControls /> : undefined}
          businessIdentity={businessIdentity}
          currentPath="/owner"
        />
      </div>
      <OwnerConsolePage />
    </CardForgeAppProviders>
  );
}
