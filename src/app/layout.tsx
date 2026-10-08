import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import './cardforgePresentation.css';
import './workspaceResponsiveHardening.css';

import { AnalyticsProvider } from '@/features/analytics/client';
import {
  DEFAULT_BUSINESS_IDENTITY,
  getCachedBusinessIdentity,
} from '@/features/business-identity/server';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';
import {
  DEFAULT_PUBLIC_SITE_CONFIGURATION,
  getCachedPublicSiteConfiguration,
  getCachedSiteMedia,
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
} from '@/features/public-site/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import { resolveWithTimeout } from '@/shared/asyncTimeout';
import { createRootSiteMetadata, type RootSiteMetadataInput } from '@/shared/siteMetadata';

const ROOT_METADATA_TIMEOUT_MS = 800;

const compiledRootMetadataInput = (): RootSiteMetadataInput => {
  const social = getDefaultSiteMedia('brand.social');
  const favicon = getDefaultSiteMedia('brand.favicon');
  return {
    brandName: DEFAULT_BUSINESS_IDENTITY.brandName,
    homepageTitle: DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageTitle,
    homepageDescription: DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageDescription,
    searchKeywords: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.searchKeywords],
    socialImage: {
      url: social.defaultSrc ?? '/api/public/site-media/brand.social',
      width: social.width ?? 1600,
      height: social.height ?? 900,
      alt: social.alt,
    },
    faviconUrl: favicon.defaultSrc ?? '/api/public/site-media/brand.favicon',
    metadataBase: new URL(getPublicAppUrl()),
  };
};

const loadRootMetadataInput = async (): Promise<RootSiteMetadataInput> => {
  const fallback = compiledRootMetadataInput();
  return resolveWithTimeout(
    Promise.all([
      getCachedBusinessIdentity(),
      getCachedPublicSiteConfiguration(),
      getCachedSiteMedia(),
    ]).then(([identity, configuration, media]) => {
      const social = media.find((asset) => asset.slot === 'brand.social')
        ?? getDefaultSiteMedia('brand.social');
      const favicon = media.find((asset) => asset.slot === 'brand.favicon')
        ?? getDefaultSiteMedia('brand.favicon');
      return {
        brandName: identity.brandName,
        homepageTitle: configuration.homepageTitle,
        homepageDescription: configuration.homepageDescription,
        searchKeywords: [...configuration.searchKeywords],
        socialImage: {
          url: getSiteMediaDisplaySrc(social) ?? fallback.socialImage.url,
          width: social.width ?? fallback.socialImage.width,
          height: social.height ?? fallback.socialImage.height,
          alt: social.alt || `${identity.brandName} preview`,
        },
        faviconUrl: getSiteMediaDisplaySrc(favicon) ?? fallback.faviconUrl,
        metadataBase: fallback.metadataBase,
      };
    }),
    {
      fallback,
      timeoutMs: ROOT_METADATA_TIMEOUT_MS,
    },
  );
};

export async function generateMetadata(): Promise<Metadata> {
  return createRootSiteMetadata(await loadRootMetadataInput());
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const experienceSettings = await getCachedExperienceSettings();
  const app = isClerkServerConfigPresent()
    ? <ClerkProvider>{children}</ClerkProvider>
    : children;

  return (
    <html
      lang="en"
      data-cf-palette={experienceSettings.presentationPalette}
      data-cf-accent={experienceSettings.presentationAccent}
      data-cf-corners={experienceSettings.presentationCorners}
      data-cf-contrast={experienceSettings.presentationContrast}
    >
      <body className="font-sans antialiased">
        <div id="cardforge-app-content">{app}</div>
        <Suspense fallback={null}><AnalyticsProvider presentation={experienceSettings.analyticsConsentPresentation} /></Suspense>
      </body>
    </html>
  );
}