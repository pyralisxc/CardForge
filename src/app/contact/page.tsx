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

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const params = await searchParams;
  const isBusinessInquiry = params.kind === 'business';
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('contact'),
    getCachedPublicSiteConfiguration(),
  ]);
  return (
    <ConfiguredPublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration}>
      <ContactRequestForm
        kind={isBusinessInquiry ? 'business' : 'support'}
        defaultEmail=""
        defaultSubject={isBusinessInquiry ? 'CardForge Business Solutions inquiry' : 'CardForge support request'}
      />
    </ConfiguredPublicLegalPage>
  );
}
