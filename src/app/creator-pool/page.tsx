import {
  ConfiguredPublicLegalPage,
  getCachedPublishedLegalDocument,
} from '@/features/legal/server';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Creator Pool Archive Notice',
  description: 'Archived notice for a CardForge program that is not active and does not accept participants or promise payouts.',
  path: '/creator-pool',
  index: false,
});

export default async function CreatorPoolPage() {
  const [{ businessIdentity, document }, siteConfiguration] = await Promise.all([
    getCachedPublishedLegalDocument('creator-pool'),
    getCachedPublicSiteConfiguration(),
  ]);
  return <ConfiguredPublicLegalPage businessIdentity={businessIdentity} document={document} siteConfiguration={siteConfiguration} />;
}
