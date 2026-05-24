import type { Metadata } from 'next';

import { OwnerConsolePage } from '@/features/owner/components/OwnerConsolePage';

export const metadata: Metadata = {
  title: 'Owner Console | CardForge Library Command',
  description: 'Control CardForge launch readiness, feature voting, developer asset rules, legal pages, and account access mechanics.',
};

export default function OwnerPage() {
  return <OwnerConsolePage />;
}
