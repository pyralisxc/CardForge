import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Refund and Cancellation Policy',
  description: 'Cancellation and refund handling for Creator Pass and separate CardForge creator-support payments.',
  path: '/refund',
});

export default async function RefundPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('refund'),
    getCachedPublicSiteConfiguration(),
  ]);
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration} />;
}
