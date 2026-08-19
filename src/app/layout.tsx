import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import './globals.css';

import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  getCachedPublicSiteConfiguration,
  getCachedSiteMedia,
  getDefaultSiteMedia,
  getSiteMediaContentType,
  getSiteMediaDisplaySrc,
  type SiteMediaAsset,
} from '@/features/public-site/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const assetFor = (media: SiteMediaAsset[], slot: SiteMediaAsset['slot']): SiteMediaAsset => (
  media.find((asset) => asset.slot === slot) ?? getDefaultSiteMedia(slot)
);

export async function generateMetadata(): Promise<Metadata> {
  const [identity, settings, media] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedPublicSiteConfiguration(),
    getCachedSiteMedia(),
  ]);
  const favicon = assetFor(media, 'brand.favicon');
  const socialImage = assetFor(media, 'brand.social');
  const faviconUrl = getSiteMediaDisplaySrc(favicon) ?? '/brand/cardforge-studio/favicon.svg';
  const socialImageUrl = getSiteMediaDisplaySrc(socialImage) ?? '/site-fallbacks/landing/cardforge-hero-workbench.png';

  return {
    metadataBase: new URL(getPublicAppUrl()),
    title: {
      default: `${identity.brandName} | ${settings.homepageTitle}`,
      template: `%s | ${identity.brandName}`,
    },
    description: settings.homepageDescription,
    keywords: settings.searchKeywords,
    icons: {
      icon: [{ url: faviconUrl, type: favicon.storagePath ? getSiteMediaContentType('brand.favicon') : 'image/svg+xml' }],
      shortcut: faviconUrl,
      apple: faviconUrl,
    },
    openGraph: {
      siteName: identity.brandName,
      images: [{ url: socialImageUrl, width: 1600, height: 900, alt: socialImage.alt }],
    },
    twitter: { card: 'summary_large_image', images: [socialImageUrl] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = isClerkServerConfigPresent()
    ? <ClerkProvider>{children}</ClerkProvider>
    : children;

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div id="cardforge-app-content">{app}</div>
      </body>
    </html>
  );
}
