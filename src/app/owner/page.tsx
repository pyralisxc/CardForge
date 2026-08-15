import type { Metadata } from 'next';

import { DeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { OwnerConsolePage } from '@/features/owner/client';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Owner Console',
  description: 'Control CardForge launch readiness, feature voting, contributor asset rules, legal pages, and account access mechanics.',
  path: '/owner',
  index: false,
});

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; pipelineStatus?: string }>;
}) {
  const params = await searchParams;
  const authConfigured = isClerkServerConfigPresent();
  const [businessIdentity, siteConfiguration] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedPublicSiteConfiguration(),
  ]);
  return (
    <CardForgeAppProviders>
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? <DeveloperPublicAuthSlot /> : undefined}
          businessIdentity={businessIdentity}
          currentPath="/owner"
          siteConfiguration={siteConfiguration}
        />
      </div>
      <OwnerConsolePage
        initialWorkspace={params.workspace === 'library' ? 'library' : 'overview'}
        initialPipelineStatus={params.pipelineStatus === 'submitted' ? 'submitted' : 'all'}
      />
    </CardForgeAppProviders>
  );
}
