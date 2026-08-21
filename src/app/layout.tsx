import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import './globals.css';
import './cardforgePresentation.css';

import { AnalyticsProvider } from '@/features/analytics/client';
import { DEFAULT_BUSINESS_IDENTITY } from '@/features/business-identity/server';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const defaultSocialImage = '/api/public/site-media/brand.social';
const defaultFavicon = '/api/public/site-media/brand.favicon';

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: {
    default: `${DEFAULT_BUSINESS_IDENTITY.brandName} | ${DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageTitle}`,
    template: `%s | ${DEFAULT_BUSINESS_IDENTITY.brandName}`,
  },
  description: DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageDescription,
  keywords: DEFAULT_PUBLIC_SITE_CONFIGURATION.searchKeywords,
  icons: {
    icon: defaultFavicon,
    shortcut: defaultFavicon,
    apple: defaultFavicon,
  },
  openGraph: {
    siteName: DEFAULT_BUSINESS_IDENTITY.brandName,
    images: [{
      url: defaultSocialImage,
      width: 1600,
      height: 900,
      alt: `${DEFAULT_BUSINESS_IDENTITY.brandName} preview`,
    }],
  },
  twitter: { card: 'summary_large_image', images: [defaultSocialImage] },
};

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
    <html lang="en">
      <body className="font-sans antialiased">
        <div id="cardforge-app-content">{app}</div>
        <AnalyticsProvider presentation={experienceSettings.analyticsConsentPresentation} />
      </body>
    </html>
  );
}
