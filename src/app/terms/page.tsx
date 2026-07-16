import { PublicLegalPage } from '@/features/legal/client';
import { getPublishedLegalDocument } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const { settings, document } = await getPublishedLegalDocument('terms');
  return <PublicLegalPage settings={settings} document={document} />;
}
