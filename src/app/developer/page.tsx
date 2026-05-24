import type { Metadata } from 'next';

import { DeveloperProgramPage } from '@/features/developer-assets/components/DeveloperProgramPage';
import { isClerkServerConfigPresent } from '@/lib/clerkConfig';

export const metadata: Metadata = {
  title: 'Become a CardForge Developer | Forge Review',
  description: 'Apply for the CardForge developer program, review asset standards, and access the Forge Review asset submission hub.',
};

export default function DeveloperPage() {
  return <DeveloperProgramPage initialAuthConfigured={isClerkServerConfigPresent()} />;
}
