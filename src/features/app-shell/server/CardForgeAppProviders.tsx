import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/toaster';
import {
  createPublicShareSettings,
  PublicShareSettingsProvider,
} from '@/features/card-generator/client';
import {
  createSiteContentMap,
  getCachedSiteContentBlocks,
} from '@/features/public-site/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

export async function CardForgeAppProviders({ children }: { children: ReactNode }) {
  const sharingCopy = createSiteContentMap(await getCachedSiteContentBlocks('sharing'));
  const shareSettings = createPublicShareSettings(
    sharingCopy['sharing.message'],
    getPublicAppUrl(),
  );
  const app = (
    <PublicShareSettingsProvider settings={shareSettings}>
      {children}
      <Toaster />
    </PublicShareSettingsProvider>
  );

  return isClerkServerConfigPresent()
    ? <ClerkProvider>{app}</ClerkProvider>
    : app;
}
