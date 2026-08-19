import { ContactRequestForm } from '@/features/contact/client/form';
import {
  ConfiguredPublicLegalPage,
  getCachedPublishedLegalDocument,
} from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Contact CardForge',
  description: 'Contact CardForge Studio for product support, billing, privacy, accessibility, developer, or legal questions.',
  path: '/contact',
});

export default async function ContactPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('contact'),
    getCachedPublicSiteConfiguration(),
  ]);
  return (
    <ConfiguredPublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration}>
      <ContactRequestForm kind="support" defaultEmail="" defaultSubject="CardForge support request" />
    </ConfiguredPublicLegalPage>
  );
}
