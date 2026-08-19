import {
  ConfiguredPublicLegalPage,
  getCachedPublishedLegalDocument,
} from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Creator Pass Terms',
  description: 'Price, renewal, access, cancellation, billing-portal, tax, and refund terms for CardForge Creator Pass.',
  path: '/creator-pass-terms',
});

export default async function CreatorPassTermsPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('creator-pass-terms'),
    getCachedPublicSiteConfiguration(),
  ]);
  return <ConfiguredPublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration} />;
}
