import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Developer Contributor Terms',
  description: 'Terms for submitting and reviewing developer-contributed assets for CardForge Studio.',
  path: '/developer-terms',
});

export default async function DeveloperTermsPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('developer-terms');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
