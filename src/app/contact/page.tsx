import { PublicLegalPage } from '@/features/legal/client';
import { ContactRequestForm } from '@/features/contact/client/form';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';

export default async function ContactPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('contact');
  return (
    <PublicLegalPage businessIdentity={businessIdentity} document={document}>
      <ContactRequestForm kind="support" defaultEmail="" defaultSubject="CardForge support request" />
    </PublicLegalPage>
  );
}
