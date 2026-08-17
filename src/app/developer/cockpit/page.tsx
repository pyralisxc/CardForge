import type { Metadata } from 'next';

import { DeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { DeveloperCockpitPage } from '@/features/developer-cockpit/client';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Developer Cockpit',
  description: 'Protected CardForge workspace for asset review, campaign packages, site proposals, and owner-approved publishing.',
  path: '/developer/cockpit',
  index: false,
});

export default async function DeveloperCockpitRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; submission?: string }>;
}) {
  const requestedParams = await searchParams;
  const initialTab = requestedParams.tab === 'library' ? 'library' : undefined;
  const initialSubmissionId = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(requestedParams.submission ?? '')
    ? requestedParams.submission
    : undefined;
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
          currentPath="/developer/cockpit"
          siteConfiguration={siteConfiguration}
        />
      </div>
      <DeveloperCockpitPage initialTab={initialTab} initialSubmissionId={initialSubmissionId} />
    </CardForgeAppProviders>
  );
}
