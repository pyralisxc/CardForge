import type { Metadata } from 'next';

import { PublicAuthControls } from '@/features/account/client/auth';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { RoadmapPage } from '@/features/roadmap/client';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';
import { createBreadcrumbStructuredData, PublicSiteShell, StructuredData } from '@/features/public-site/server';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Roadmap',
  description: 'Vote on CardForge feature priorities and follow planned service upgrades for the shared card-system studio.',
  path: '/roadmap',
});

export default async function ForgeChroniclePage() {
  const authConfigured = isClerkServerConfigPresent();
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <CardForgeAppProviders>
      <PublicSiteShell businessIdentity={businessIdentity} accountSlot={authConfigured ? <PublicAuthControls /> : undefined} currentPath="/roadmap">
        <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
          { name: 'Home', path: '/' },
          { name: 'Roadmap', path: '/roadmap' },
        ])} />
        <RoadmapPage initialAuthConfigured={authConfigured} supportEmail={businessIdentity.supportEmail} />
      </PublicSiteShell>
    </CardForgeAppProviders>
  );
}
