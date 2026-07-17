import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';

export default async function PrivacyPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('privacy');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
