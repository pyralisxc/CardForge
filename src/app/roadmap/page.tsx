import type { Metadata } from 'next';

import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { RoadmapPage } from '@/features/roadmap/client';
import { getPublishedLegalDocument } from '@/features/legal/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CardForge Roadmap | Forge Chronicle',
  description: 'Vote on CardForge feature priorities and follow the monthly level-up roadmap for the shared card-system studio.',
};

export default async function ForgeChroniclePage() {
  const [{ settings }, { authConfigured, ownerAccess }] = await Promise.all([
    getPublishedLegalDocument('contact'),
    getCurrentCardforgeUserAccess(),
  ]);
  return (
    <>
      <PublicSiteHeader currentPath="/roadmap" showOwnerLink={ownerAccess.isOwner} />
      <RoadmapPage initialAuthConfigured={authConfigured} supportEmail={settings.supportEmail} />
    </>
  );
}
