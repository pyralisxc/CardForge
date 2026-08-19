import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/toaster';
import { BrandPresentationProvider, type BrandPresentation } from '@/features/brand-presentation/client';
import {
  createPublicShareSettings,
  PublicShareSettingsProvider,
} from '@/features/card-generator/client';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';
import {
  createSiteContentMap,
  getCachedPublicSiteConfiguration,
  getCachedSiteContentBlocks,
  getCachedSiteMedia,
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  type SiteMediaAsset,
} from '@/features/public-site/server';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import { ScopedAnalyticsProvider } from '../components/ScopedAnalyticsProvider';

const assetFor = (media: SiteMediaAsset[], slot: SiteMediaAsset['slot']): SiteMediaAsset => (
  media.find((asset) => asset.slot === slot) ?? getDefaultSiteMedia(slot)
);

const createStudioBrandPresentation = (
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

export async function StudioAppProviders({
  brandName,
  children,
}: {
  brandName: string;
  children: ReactNode;
}) {
  const [experienceSettings, sharingBlocks, siteMedia, siteConfiguration] = await Promise.all([
    getCachedExperienceSettings(),
    getCachedSiteContentBlocks('sharing'),
    getCachedSiteMedia(),
    getCachedPublicSiteConfiguration(),
  ]);
  const sharingCopy = createSiteContentMap(sharingBlocks);
  const shareSettings = createPublicShareSettings(
    sharingCopy['sharing.message'],
    getPublicAppUrl(),
  );
  const brand = createStudioBrandPresentation(siteMedia, siteConfiguration, brandName);

  return (
    <>
      <BrandPresentationProvider value={brand}>
        <PublicShareSettingsProvider settings={shareSettings}>
          {children}
          <Toaster />
        </PublicShareSettingsProvider>
      </BrandPresentationProvider>
      <ScopedAnalyticsProvider presentation={experienceSettings.analyticsConsentPresentation} />
    </>
  );
}
