import type { Metadata } from 'next';

import { DeveloperProgramPage } from '@/features/developer-assets/client/program';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { getPublishedLegalDocument } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Join the CardForge Community | Forge Review',
  description: 'Apply for the CardForge developer program, review contribution standards, and help shape the shared forge library.',
};

export default async function DeveloperPage() {
  const { settings } = await getPublishedLegalDocument('contact');
  return (
    <DeveloperProgramPage
      initialAuthConfigured={isClerkServerConfigPresent()}
      supportEmail={settings.supportEmail}
    />
  );
}
