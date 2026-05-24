import { PublicLegalPage } from '@/features/legal/components/PublicLegalPage';
import { getPublishedLegalDocument } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export default async function RefundPage() {
  const { settings, document } = await getPublishedLegalDocument('refund');
  return <PublicLegalPage settings={settings} document={document} />;
}
