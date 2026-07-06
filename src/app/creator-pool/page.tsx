import { PublicLegalPage } from '@/features/legal/components/PublicLegalPage';
import { getPublishedLegalDocument } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export default async function CreatorPoolPage() {
  const { settings, document } = await getPublishedLegalDocument('creator-pool');
  return <PublicLegalPage settings={settings} document={document} />;
}
