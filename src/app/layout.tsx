import { ClerkProvider } from '@clerk/nextjs';
import type {Metadata} from 'next';
import './globals.css';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import { AnalyticsProvider } from '@/features/analytics/client';
import {
  FounderProfileProvider,
  SiteContentProvider,
} from '@/features/public-site/client/context';
import { BrandPresentationProvider, type BrandPresentation } from '@/features/brand-presentation/client';
import {
  createSiteContentMap,
  getCachedAllSiteContentBlocks,
  getCachedFounderProfile,
  getCachedPublicSiteConfiguration,
  getCachedSiteMedia,
  getDefaultSiteMedia,
  getSiteMediaContentType,
  getSiteMediaDisplaySrc,
  type SiteMediaAsset,
} from '@/features/public-site/server';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

const assetFor = (media: SiteMediaAsset[], slot: SiteMediaAsset['slot']): SiteMediaAsset => (
  media.find((asset) => asset.slot === slot) ?? getDefaultSiteMedia(slot)
);

const createBrandPresentation = (
  media: SiteMediaAsset[],
  settings: Awaited<ReturnType<typeof getCachedPublicSiteConfiguration>>,
  brandName: string,
): BrandPresentation => {
  const watermark = assetFor(media, 'brand.watermark');
  return ({
    brandName,
    markUrl: getSiteMediaDisplaySrc(assetFor(media, 'brand.mark')) ?? '/brand/cardforge-studio/brand-mark.svg',
    faviconUrl: getSiteMediaDisplaySrc(assetFor(media, 'brand.favicon')) ?? '/brand/cardforge-studio/favicon.svg',
    socialImageUrl: getSiteMediaDisplaySrc(assetFor(media, 'brand.social')) ?? '/site-fallbacks/landing/cardforge-hero-workbench.png',
    watermarkUrl: getSiteMediaDisplaySrc(watermark) ?? '/brand/cardforge-studio/watermark.svg',
    watermarkWidth: watermark.width ?? 1000,
    watermarkHeight: watermark.height ?? 260,
    watermarkPreviewOpacity: settings.watermarkPreviewOpacity / 100,
    watermarkShareOpacity: settings.watermarkShareOpacity / 100,
    watermarkWidthPercent: settings.watermarkWidthPercent,
  });
};

export async function generateMetadata(): Promise<Metadata> {
  const [identity, settings, media] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedPublicSiteConfiguration(),
    getCachedSiteMedia(),
  ]);
  const brand = createBrandPresentation(media, settings, identity.brandName);
  const favicon = assetFor(media, 'brand.favicon');
  const socialImage = assetFor(media, 'brand.social');
  return {
    metadataBase: new URL(getPublicAppUrl()),
    title: {
      default: `${identity.brandName} | ${settings.homepageTitle}`,
      template: `%s | ${identity.brandName}`,
    },
    description: settings.homepageDescription,
    keywords: settings.searchKeywords,
    icons: {
      icon: [{ url: brand.faviconUrl, type: favicon.storagePath ? getSiteMediaContentType('brand.favicon') : 'image/svg+xml' }],
      shortcut: brand.faviconUrl,
      apple: brand.faviconUrl,
    },
    openGraph: {
      siteName: identity.brandName,
      images: [{ url: brand.socialImageUrl, width: 1600, height: 900, alt: socialImage.alt }],
    },
    twitter: { card: 'summary_large_image', images: [brand.socialImageUrl] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [founderProfile, experienceSettings, siteContentBlocks, siteMedia, siteConfiguration, businessIdentity] = await Promise.all([
    getCachedFounderProfile(),
    getCachedExperienceSettings(),
    getCachedAllSiteContentBlocks(),
    getCachedSiteMedia(),
    getCachedPublicSiteConfiguration(),
    getCachedBusinessIdentity(),
  ]);
  const brand = createBrandPresentation(siteMedia, siteConfiguration, businessIdentity.brandName);
  const app = (
    <BrandPresentationProvider value={brand}>
      <SiteContentProvider content={createSiteContentMap(siteContentBlocks)}>
        <FounderProfileProvider profile={founderProfile}>
          {children}
        </FounderProfileProvider>
      </SiteContentProvider>
    </BrandPresentationProvider>
  );
  const authenticatedApp = isClerkServerConfigPresent()
    ? <ClerkProvider>{app}</ClerkProvider>
    : app;

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div id="cardforge-app-content">{authenticatedApp}</div>
        <AnalyticsProvider presentation={experienceSettings.analyticsConsentPresentation} />
      </body>
    </html>
  );
}
