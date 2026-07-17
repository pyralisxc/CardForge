import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';

export default async function DeveloperTermsPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('developer-terms');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
