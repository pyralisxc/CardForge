import type { Metadata } from 'next';

import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { OwnerConsolePage } from '@/features/owner/client';

export const metadata: Metadata = {
  title: 'Owner Console | CardForge Library Command',
  description: 'Control CardForge launch readiness, feature voting, contributor asset rules, legal pages, and account access mechanics.',
};

export default function OwnerPage() {
  return (
    <>
      <PublicSiteHeader currentPath="/owner" showOwnerLink title="Owner Forge" />
      <OwnerConsolePage />
    </>
  );
}
