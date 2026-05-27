import type { Metadata } from 'next';

import { RoadmapPage } from '@/features/account/components/RoadmapPage';
import { isClerkServerConfigPresent } from '@/lib/clerkConfig';

export const metadata: Metadata = {
  title: 'CardForge Roadmap | Forge Chronicle',
  description: 'Vote on CardForge feature priorities and follow the monthly level-up roadmap for the shared card-system studio.',
};

export default function ForgeChroniclePage() {
  return <RoadmapPage initialAuthConfigured={isClerkServerConfigPresent()} />;
}
