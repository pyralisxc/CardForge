import { PublicLegalPage } from '@/features/legal/components/PublicLegalPage';
import { getPublishedLegalDocument } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const { settings, document } = await getPublishedLegalDocument('terms');
  return <PublicLegalPage settings={settings} document={document} />;
}
