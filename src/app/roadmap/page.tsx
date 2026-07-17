import type { Metadata } from 'next';

import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
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
    <>
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'Roadmap', path: '/roadmap' },
      ])} />
      <PublicSiteHeader currentPath="/roadmap" />
      <RoadmapPage initialAuthConfigured={isClerkServerConfigPresent()} supportEmail={businessIdentity.supportEmail} />
    </>
  );
}
