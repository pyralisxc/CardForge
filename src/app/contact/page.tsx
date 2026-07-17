import { PublicLegalPage } from '@/features/legal/client';
import { ContactRequestForm } from '@/features/contact/client/form';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Contact CardForge',
  description: 'Contact CardForge Studio for product support, billing, privacy, accessibility, developer, or legal questions.',
  path: '/contact',
});

export default async function ContactPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('contact');
  return (
    <PublicLegalPage businessIdentity={businessIdentity} document={document}>
      <ContactRequestForm kind="support" defaultEmail="" defaultSubject="CardForge support request" />
    </PublicLegalPage>
  );
}
