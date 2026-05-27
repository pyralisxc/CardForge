import type { Metadata } from 'next';

import { DeveloperProgramPage } from '@/features/developer-assets/components/DeveloperProgramPage';
import { isClerkServerConfigPresent } from '@/lib/clerkConfig';

export const metadata: Metadata = {
  title: 'Join the CardForge Community | Forge Review',
  description: 'Apply for the CardForge developer program, review contribution standards, and help shape the shared forge library.',
};

export default function DeveloperPage() {
  return <DeveloperProgramPage initialAuthConfigured={isClerkServerConfigPresent()} />;
}
