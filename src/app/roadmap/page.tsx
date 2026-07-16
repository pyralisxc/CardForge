import type { Metadata } from 'next';

import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { getBusinessIdentity } from '@/features/business-identity/server';
import { RoadmapPage } from '@/features/roadmap/client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CardForge Roadmap | Forge Chronicle',
  description: 'Vote on CardForge feature priorities and follow the monthly level-up roadmap for the shared card-system studio.',
};

export default async function ForgeChroniclePage() {
  const [businessIdentity, { authConfigured, ownerAccess }] = await Promise.all([
    getBusinessIdentity(),
    getCurrentCardforgeUserAccess(),
  ]);
  return (
    <>
      <PublicSiteHeader currentPath="/roadmap" showOwnerLink={ownerAccess.isOwner} />
      <RoadmapPage initialAuthConfigured={authConfigured} supportEmail={businessIdentity.supportEmail} />
    </>
  );
}
