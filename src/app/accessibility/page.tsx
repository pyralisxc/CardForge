import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Accessibility Statement',
  description: 'CardForge Studio accessibility goals, known limitations, and the route for reporting an accessibility barrier.',
  path: '/accessibility',
});

export default async function AccessibilityStatementPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('accessibility'),
    getCachedPublicSiteConfiguration(),
  ]);
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration} />;
}
