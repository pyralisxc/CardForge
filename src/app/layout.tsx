
import type {Metadata} from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import { BrowserStorageAlerts } from '@/features/project/client';
import {
  createPublicShareSettings,
  PublicShareSettingsProvider,
} from '@/features/card-generator/client';
import {
  createSiteContentMap,
  FounderProfileProvider,
} from '@/features/public-site/client';
import { getCachedFounderProfile, getCachedSiteContentBlocks } from '@/features/public-site/server';

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: {
    default: 'CardForge Studio | Build Complete Card Sets',
    template: '%s | CardForge Studio',
  },
  description: 'Design reusable card templates, connect structured data, review complete sets, and export production-ready files.',
  keywords: [
    'card maker',
    'TCG card generator',
    'tabletop card creator',
    'printable card templates',
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
  const [founderProfile, sharingBlocks] = await Promise.all([
    getCachedFounderProfile(),
    getCachedSiteContentBlocks('sharing'),
  ]);
  const sharingCopy = createSiteContentMap(sharingBlocks);
  const shareSettings = createPublicShareSettings(
    sharingCopy['sharing.message'],
    getPublicAppUrl(),
  );
  const app = (
    <FounderProfileProvider profile={founderProfile}>
      <PublicShareSettingsProvider settings={shareSettings}>
        {children}
        <BrowserStorageAlerts />
        <Toaster />
      </PublicShareSettingsProvider>
    </FounderProfileProvider>
  );

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {isClerkServerConfigPresent()
          ? <ClerkProvider>{app}</ClerkProvider>
          : app}
      </body>
    </html>
  );
}
