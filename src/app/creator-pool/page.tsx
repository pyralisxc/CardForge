import { PublicLegalPage } from '@/features/legal/client';
import { getPublishedLegalDocument } from '@/features/legal/server';

export const dynamic = 'force-dynamic';

export default async function CreatorPoolPage() {
  const { settings, document } = await getPublishedLegalDocument('creator-pool');
  return <PublicLegalPage settings={settings} document={document} />;
}
