import Image, { type ImageProps } from 'next/image';
import type { CSSProperties } from 'react';

import {
  getSiteMediaDisplaySrc,
  type SiteMediaAsset,
  type SiteMediaPresentation,
} from '../model/siteMedia';

type SiteMediaCssProperties = CSSProperties & {
  '--site-media-desktop-position': string;
  '--site-media-mobile-position': string;
  '--site-media-desktop-zoom': number;
  '--site-media-mobile-zoom': number;
};

export const getSiteMediaImageStyle = (
  presentation: SiteMediaPresentation,
): SiteMediaCssProperties => ({
  '--site-media-desktop-position': `${presentation.desktopFocalX}% ${presentation.desktopFocalY}%`,
  '--site-media-mobile-position': `${presentation.mobileFocalX}% ${presentation.mobileFocalY}%`,
  '--site-media-desktop-zoom': presentation.desktopZoom,
  '--site-media-mobile-zoom': presentation.mobileZoom,
});

export const getSiteMediaFrameAspectRatio = (presentation: SiteMediaPresentation): string | undefined => {
  if (presentation.frame === 'wide') return '16 / 9';
  if (presentation.frame === 'portrait') return '4 / 5';
  return undefined;
};

type ResponsiveSiteMediaImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  media: SiteMediaAsset;
  srcOverride?: string | null;
  previewViewport?: 'desktop' | 'mobile';
};

export function ResponsiveSiteMediaImage({
  media,
  srcOverride,
  previewViewport,
  className = '',
  style,
  ...imageProps
}: ResponsiveSiteMediaImageProps) {
  const src = srcOverride === undefined ? getSiteMediaDisplaySrc(media) : srcOverride;
  if (!src) return null;
  const presentationStyle = getSiteMediaImageStyle(media.presentation);

  return (
    <Image
      {...imageProps}
      src={src}
      alt={media.alt}
      data-preview-viewport={previewViewport}
      className={`site-media-responsive-image ${media.presentation.fit === 'cover' ? 'object-cover' : 'object-contain'} ${className}`}
      style={{ ...presentationStyle, ...style }}
    />
  );
}
