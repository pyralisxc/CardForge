import {
  ConfiguredPublicLegalPage,
  getCachedPublishedLegalDocument,
} from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Privacy Policy',
  description: 'How CardForge Studio and Cameron Locke handle local project data, accounts, billing, operational records, and contact requests.',
  path: '/privacy',
});

export default async function PrivacyPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('privacy'),
    getCachedPublicSiteConfiguration(),
  ]);
  return <ConfiguredPublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration} />;
}
