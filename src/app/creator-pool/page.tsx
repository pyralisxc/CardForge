import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';

export default async function CreatorPoolPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('creator-pool');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
