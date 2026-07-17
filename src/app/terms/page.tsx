import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';

export default async function TermsPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('terms');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
