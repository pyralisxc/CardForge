import { PublicLegalPage } from '@/features/legal/components/PublicLegalPage';
import { getPublishedLegalDocument } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const { settings, document } = await getPublishedLegalDocument('contact');
  return <PublicLegalPage settings={settings} document={document} />;
}
