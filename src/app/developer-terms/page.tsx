import { PublicLegalPage } from '@/features/legal/client';
import { getPublishedLegalDocument } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

export default async function DeveloperTermsPage() {
  const { settings, document } = await getPublishedLegalDocument('developer-terms');
  return <PublicLegalPage settings={settings} document={document} />;
}
