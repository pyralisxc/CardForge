import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Refund and Cancellation Policy',
  description: 'Cancellation and refund handling for Creator Pass and separate CardForge creator-support payments.',
  path: '/refund',
});

export default async function RefundPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('refund');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
