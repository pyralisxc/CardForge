import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Creator Pool Archive Notice',
  description: 'Archived notice for a CardForge program that is not active and does not accept participants or promise payouts.',
  path: '/creator-pool',
  index: false,
});

export default async function CreatorPoolPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('creator-pool');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
