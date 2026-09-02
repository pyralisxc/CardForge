import { Suspense } from 'react';

import { ContributorPublicAuthControls } from '@/features/contributor-access/components/ContributorPublicAuthControls';

export function ContributorPublicAuthSlot() {
  return <Suspense fallback={null}><ContributorPublicAuthControls /></Suspense>;
}
