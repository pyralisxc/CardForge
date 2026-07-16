import { PublicLegalPage } from '@/features/legal/client';
import { getPublishedLegalDocument } from '@/features/legal/server';

export const dynamic = 'force-dynamic';

export default async function RefundPage() {
  const { settings, document } = await getPublishedLegalDocument('refund');
  return <PublicLegalPage settings={settings} document={document} />;
}
