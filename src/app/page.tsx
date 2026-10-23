import { Suspense } from 'react';

import { ContributorPublicAuthSlot } from '@/features/contributor-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  HomepagePageContent,
} from '@/features/public-site/client/landing';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import {
  createCardForgeStructuredData,
  getCachedSiteMedia,
  getCachedPublicSiteConfiguration,
  StructuredData,
} from '@/features/public-site/server';
import { resolveLiveWebsitePresentation } from '@/features/public-site/server/websitePresentationResolver';
import { createPageMetadata } from '@/shared/siteMetadata';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import {
  applyProductAccessPricePresentation,
  getMcpAllowances,
} from '@/features/mcp-usage/server';
import { getCurrentProductAccessPricePresentation } from '@/features/billing/server/productAccessPricePresentation';
import { OwnerPublicSiteControlsSlot } from '@/app/_components/OwnerPublicSiteControlsSlot';

export async function generateMetadata() {
  const resolved = await resolveLiveWebsitePresentation();
  const siteConfiguration = resolved.configuration;
  return createPageMetadata({
    title: siteConfiguration.homepageTitle,
    description: siteConfiguration.homepageDescription,
    keywords: siteConfiguration.searchKeywords,
    path: '/',
    ...(resolved.privatePreview ? { robots: { index: false, follow: false } } : {}),
  });
}

export default async function LandingPage() {
  const authConfigured = isClerkServerConfigPresent();
  const [
    businessIdentity,
    siteMedia,
    siteConfiguration,
    basePlans,
    productAccessPrices,
  ] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedSiteMedia(),
    getCachedPublicSiteConfiguration(),
    getMcpAllowances(),
    getCurrentProductAccessPricePresentation(),
  ]);
  const plans = applyProductAccessPricePresentation(basePlans, productAccessPrices);

  return (
    <CardForgeAppProviders>
      <PublicSiteShell
        accountSlot={authConfigured ? <ContributorPublicAuthSlot /> : undefined}
        businessIdentity={businessIdentity}
        currentPath="/"
        siteConfiguration={siteConfiguration}
      >
        <StructuredData value={createCardForgeStructuredData(
          businessIdentity,
          siteMedia.find((asset) => asset.slot === 'brand.mark'),
        )} />
        <HomepagePageContent siteConfiguration={siteConfiguration} siteMedia={siteMedia} plans={plans} founderName={businessIdentity.legalOperatorName} />
        <Suspense fallback={null}>
          <OwnerPublicSiteControlsSlot currentPath="/" />
        </Suspense>
      </PublicSiteShell>
    </CardForgeAppProviders>
  );
}