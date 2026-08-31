import {
  ConfiguredPublicLegalPage,
  getCachedPublishedLegalDocument,
} from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Contributor Terms',
  description: 'Terms for submitting and reviewing Contributor assets for CardForge Studio.',
  path: '/contributor-terms',
});

export default async function ContributorTermsPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('contributor-terms'),
    getCachedPublicSiteConfiguration(),
  ]);
  return <ConfiguredPublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration} />;
}
