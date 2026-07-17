import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';

export default async function RefundPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('refund');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
