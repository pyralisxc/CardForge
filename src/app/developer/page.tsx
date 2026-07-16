import type { Metadata } from 'next';

import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { DeveloperProgramPage } from '@/features/developer-assets/client/program';
import { getPublishedLegalDocument } from '@/features/legal/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Join the CardForge Community | Forge Review',
  description: 'Apply for the CardForge developer program, review contribution standards, and help shape the shared forge library.',
};

export default async function DeveloperPage() {
  const [{ settings }, { authConfigured, ownerAccess }] = await Promise.all([
    getPublishedLegalDocument('contact'),
    getCurrentCardforgeUserAccess(),
  ]);
  return (
    <>
      <PublicSiteHeader currentPath="/developer" showOwnerLink={ownerAccess.isOwner} />
      <DeveloperProgramPage initialAuthConfigured={authConfigured} supportEmail={settings.supportEmail} />
    </>
  );
}
