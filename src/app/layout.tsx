
import type {Metadata} from 'next';
import './globals.css';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import { AnalyticsProvider, AnalyticsReplayBoundary } from '@/features/analytics/client';
import {
  FounderProfileProvider,
} from '@/features/public-site/client/context';
import { getCachedFounderProfile } from '@/features/public-site/server';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: {
    default: 'CardForge Studio | Build Complete Card Sets',
    template: '%s | CardForge Studio',
  },
  description: 'Create highly customized card sets with reusable layouts, structured data, whole-set review, and production-ready exports.',
  keywords: [
    'card maker',
    'TCG card generator',
    'tabletop card creator',
    'printable card templates',
    'printable design software',
    'custom card set creator',
    'bulk card generator',
    'card system studio',
    'developer asset pipeline',
    'fantasy card template editor',
    'local-first card design studio',
  ],
  icons: {
    icon: '/brand/cardforge-studio/favicon.svg',
    shortcut: '/brand/cardforge-studio/favicon.svg',
    apple: '/brand/cardforge-studio/favicon.svg',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [founderProfile, experienceSettings] = await Promise.all([
    getCachedFounderProfile(),
    getCachedExperienceSettings(),
  ]);
  const app = (
    <FounderProfileProvider profile={founderProfile}>
      {children}
    </FounderProfileProvider>
  );

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AnalyticsReplayBoundary>{app}</AnalyticsReplayBoundary>
        <AnalyticsProvider presentation={experienceSettings.analyticsConsentPresentation} />
      </body>
    </html>
  );
}
