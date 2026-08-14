import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Supporter Terms',
  description: 'Terms for voluntary support of Cameron Locke that is separate from CardForge product access.',
  path: '/supporter-terms',
});

export default async function SupporterTermsPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('supporter-terms'),
    getCachedPublicSiteConfiguration(),
  ]);
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration} />;
}
