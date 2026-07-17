import type { Metadata } from 'next';

import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { RoadmapPage } from '@/features/roadmap/client';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export const metadata: Metadata = {
  title: 'CardForge Roadmap | Forge Chronicle',
  description: 'Vote on CardForge feature priorities and follow the monthly level-up roadmap for the shared card-system studio.',
};

export default async function ForgeChroniclePage() {
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <>
      <PublicSiteHeader currentPath="/roadmap" />
      <RoadmapPage initialAuthConfigured={isClerkServerConfigPresent()} supportEmail={businessIdentity.supportEmail} />
    </>
  );
}
