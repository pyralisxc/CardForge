"use client";

import { createContext, useContext, type ReactNode } from 'react';

export interface BrandPresentation {
  brandName: string;
  markUrl: string;
  faviconUrl: string;
  socialImageUrl: string;
  watermarkUrl: string;
  watermarkWidth: number;
  watermarkHeight: number;
  watermarkPreviewOpacity: number;
  watermarkShareOpacity: number;
  watermarkWidthPercent: number;
}

export const DEFAULT_BRAND_PRESENTATION: BrandPresentation = {
  brandName: 'CardForge Studio',
  markUrl: '/brand/cardforge-studio/brand-mark.svg',
  faviconUrl: '/brand/cardforge-studio/favicon.svg',
  socialImageUrl: '/site-fallbacks/landing/cardforge-hero-workbench.png',
  watermarkUrl: '/brand/cardforge-studio/watermark.svg',
  watermarkWidth: 1000,
  watermarkHeight: 260,
  watermarkPreviewOpacity: 0.24,
  watermarkShareOpacity: 0.28,
  watermarkWidthPercent: 68,
};

const BrandPresentationContext = createContext<BrandPresentation>(DEFAULT_BRAND_PRESENTATION);

export function BrandPresentationProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: BrandPresentation;
}) {
  return <BrandPresentationContext.Provider value={value}>{children}</BrandPresentationContext.Provider>;
}

export const useBrandPresentation = (): BrandPresentation => useContext(BrandPresentationContext);
