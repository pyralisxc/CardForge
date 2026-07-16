import { PublicLegalPage } from '@/features/legal/client';
import { ContactRequestForm } from '@/features/contact/client/form';
import { getPublishedLegalDocument } from '@/features/legal/server';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const { settings, document } = await getPublishedLegalDocument('contact');
  return (
    <PublicLegalPage settings={settings} document={document}>
      <ContactRequestForm kind="support" defaultEmail="" defaultSubject="CardForge support request" />
    </PublicLegalPage>
  );
}
