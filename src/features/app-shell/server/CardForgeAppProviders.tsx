import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/toaster';
import {
  BrandPresentationProvider,
  type BrandPresentation,
} from '@/features/brand-presentation/client';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  createPublicShareSettings,
  PublicShareSettingsProvider,
} from '@/features/card-generator/client';
import {
  FounderProfileProvider,
  SiteContentProvider,
} from '@/features/public-site/client';
import {
  createSiteContentMap,
  getCachedAllSiteContentBlocks,
  getCachedFounderProfile,
  getCachedPublicSiteConfiguration,
  getCachedSiteContentBlocks,
  getCachedSiteMedia,
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  type SiteMediaAsset,
} from '@/features/public-site/server';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

export type CardForgeAppProviderScope = 'public' | 'shell' | 'studio';

const assetFor = (media: SiteMediaAsset[], slot: SiteMediaAsset['slot']): SiteMediaAsset => (
  media.find((asset) => asset.slot === slot) ?? getDefaultSiteMedia(slot)
);

const createBrandPresentation = (
  media: SiteMediaAsset[],
  settings: Awaited<ReturnType<typeof getCachedPublicSiteConfiguration>>,
  brandName: string,
): BrandPresentation => {
  const watermark = assetFor(media, 'brand.watermark');
  return {
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
  };
};

export async function CardForgeAppProviders({
  children,
  scope = 'public',
}: {
  children: ReactNode;
  scope?: CardForgeAppProviderScope;
}) {
  const [businessIdentity, siteMedia, siteConfiguration] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedSiteMedia(),
    getCachedPublicSiteConfiguration(),
  ]);
  const brand = createBrandPresentation(siteMedia, siteConfiguration, businessIdentity.brandName);

  if (scope === 'studio') {
    const sharingCopy = createSiteContentMap(await getCachedSiteContentBlocks('sharing'));
    const shareSettings = createPublicShareSettings(
      sharingCopy['sharing.message'],
      getPublicAppUrl(),
    );
    return (
      <BrandPresentationProvider value={brand}>
        <PublicShareSettingsProvider settings={shareSettings}>
          {children}
          <Toaster />
        </PublicShareSettingsProvider>
      </BrandPresentationProvider>
    );
  }

  if (scope === 'shell') {
    const [founderProfile, shellContent] = await Promise.all([
      getCachedFounderProfile(),
      getCachedSiteContentBlocks('shell'),
    ]);
    return (
      <BrandPresentationProvider value={brand}>
        <SiteContentProvider content={createSiteContentMap(shellContent)}>
          <FounderProfileProvider profile={founderProfile}>
            {children}
            <Toaster />
          </FounderProfileProvider>
        </SiteContentProvider>
      </BrandPresentationProvider>
    );
  }

  const [founderProfile, siteContentBlocks] = await Promise.all([
    getCachedFounderProfile(),
    getCachedAllSiteContentBlocks(),
  ]);
  const siteContent = createSiteContentMap(siteContentBlocks);
  const shareSettings = createPublicShareSettings(
    siteContent['sharing.message'],
    getPublicAppUrl(),
  );

  return (
    <BrandPresentationProvider value={brand}>
      <SiteContentProvider content={siteContent}>
        <FounderProfileProvider profile={founderProfile}>
          <PublicShareSettingsProvider settings={shareSettings}>
            {children}
            <Toaster />
          </PublicShareSettingsProvider>
        </FounderProfileProvider>
      </SiteContentProvider>
    </BrandPresentationProvider>
  );
}
