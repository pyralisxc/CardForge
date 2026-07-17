import type { Metadata } from 'next';

import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { DeveloperProgramPage } from '@/features/developer-assets/client/program';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export const metadata: Metadata = {
  title: 'Join the CardForge Community | Forge Review',
  description: 'Apply for the CardForge developer program, review contribution standards, and help shape the shared forge library.',
};

export default async function DeveloperPage() {
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <>
      <PublicSiteHeader currentPath="/developer" />
      <DeveloperProgramPage initialAuthConfigured={isClerkServerConfigPresent()} supportEmail={businessIdentity.supportEmail} />
    </>
  );
}
