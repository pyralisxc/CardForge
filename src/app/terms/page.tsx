import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Terms of Service',
  description: 'Terms governing CardForge Studio accounts, beta access, user content, exports, and service use.',
  path: '/terms',
});

export default async function TermsPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('terms');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
