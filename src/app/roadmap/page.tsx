import type { Metadata } from 'next';

import { RoadmapPage } from '@/features/account/components/RoadmapPage';
import { isClerkServerConfigPresent } from '@/lib/clerkConfig';
import { getPublishedLegalDocument } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CardForge Roadmap | Forge Chronicle',
  description: 'Vote on CardForge feature priorities and follow the monthly level-up roadmap for the shared card-system studio.',
};

export default async function ForgeChroniclePage() {
  const { settings } = await getPublishedLegalDocument('contact');
  return (
    <RoadmapPage
      initialAuthConfigured={isClerkServerConfigPresent()}
      supportEmail={settings.supportEmail}
    />
  );
}
