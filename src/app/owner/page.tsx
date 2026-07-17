import type { Metadata } from 'next';

import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { OwnerConsolePage } from '@/features/owner/client';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Owner Console',
  description: 'Control CardForge launch readiness, feature voting, contributor asset rules, legal pages, and account access mechanics.',
  path: '/owner',
  index: false,
});

export default function OwnerPage() {
  return (
    <>
      <PublicSiteHeader currentPath="/owner" showOwnerLink title="Owner Forge" />
      <OwnerConsolePage />
    </>
  );
}
