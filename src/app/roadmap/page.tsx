import type { Metadata } from 'next';

import { PublicAuthControls } from '@/features/account/client/auth';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import { RoadmapPage } from '@/features/roadmap/client';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';
import { createBreadcrumbStructuredData, StructuredData } from '@/features/public-site/server';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Roadmap',
  description: 'Vote on CardForge feature priorities and follow the monthly level-up roadmap for the shared card-system studio.',
  path: '/roadmap',
});

export default async function ForgeChroniclePage() {
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <CardForgeAppProviders>
      <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/roadmap">
        <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
          { name: 'Home', path: '/' },
          { name: 'Roadmap', path: '/roadmap' },
        ])} />
        <RoadmapPage initialAuthConfigured={isClerkServerConfigPresent()} supportEmail={businessIdentity.supportEmail} />
      </PublicSiteShell>
    </CardForgeAppProviders>
  );
}
