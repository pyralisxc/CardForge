import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Creator Pass Terms',
  description: 'Price, renewal, access, cancellation, billing-portal, tax, and refund terms for CardForge Creator Pass.',
  path: '/creator-pass-terms',
});

export default async function CreatorPassTermsPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('creator-pass-terms');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
