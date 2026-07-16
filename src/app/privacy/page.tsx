import { PublicLegalPage } from '@/features/legal/client';
import { getPublishedLegalDocument } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const { settings, document } = await getPublishedLegalDocument('privacy');
  return <PublicLegalPage settings={settings} document={document} />;
}
