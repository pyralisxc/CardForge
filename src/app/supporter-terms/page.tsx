import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Supporter Terms',
  description: 'Terms for voluntary support of Cameron Locke that is separate from CardForge product access.',
  path: '/supporter-terms',
});

export default async function SupporterTermsPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('supporter-terms');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
