import { PublicLegalPage } from '@/features/legal/components/PublicLegalPage';
import { getPublishedLegalDocument } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const { settings, document } = await getPublishedLegalDocument('privacy');
  return <PublicLegalPage settings={settings} document={document} />;
}
