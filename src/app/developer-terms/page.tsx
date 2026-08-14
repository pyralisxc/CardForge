import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Developer Contributor Terms',
  description: 'Terms for submitting and reviewing developer-contributed assets for CardForge Studio.',
  path: '/developer-terms',
});

export default async function DeveloperTermsPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('developer-terms'),
    getCachedPublicSiteConfiguration(),
  ]);
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration} />;
}
