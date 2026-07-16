import { PublicLegalPage } from '@/features/legal/client';
import { getPublishedLegalDocument } from '@/features/legal/server';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const { businessIdentity, document } = await getPublishedLegalDocument('privacy');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
