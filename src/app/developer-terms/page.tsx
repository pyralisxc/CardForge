import { PublicLegalPage } from '@/features/legal/components/PublicLegalPage';
import { getPublishedLegalDocument } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export default async function DeveloperTermsPage() {
  const { settings, document } = await getPublishedLegalDocument('developer-terms');
  return <PublicLegalPage settings={settings} document={document} />;
}
