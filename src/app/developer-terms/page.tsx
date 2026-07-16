import { PublicLegalPage } from '@/features/legal/client';
import { getPublishedLegalDocument } from '@/features/legal/server';

export const dynamic = 'force-dynamic';

export default async function DeveloperTermsPage() {
  const { businessIdentity, document } = await getPublishedLegalDocument('developer-terms');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
