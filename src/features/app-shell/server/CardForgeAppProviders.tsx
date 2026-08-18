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
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

export async function CardForgeAppProviders({ children }: { children: ReactNode }) {
  const sharingCopy = createSiteContentMap(await getCachedSiteContentBlocks('sharing'));
  const shareSettings = createPublicShareSettings(
    sharingCopy['sharing.message'],
    getPublicAppUrl(),
  );

  return (
    <PublicShareSettingsProvider settings={shareSettings}>
      {children}
      <Toaster />
    </PublicShareSettingsProvider>
  );
}
