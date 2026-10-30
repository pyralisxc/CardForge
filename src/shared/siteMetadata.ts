import type { Metadata } from 'next';

const DEFAULT_SOCIAL_IMAGE = {
  url: '/api/public/site-media/brand.social',
  width: 1600,
  height: 900,
};

type SocialImage = typeof DEFAULT_SOCIAL_IMAGE & { alt?: string };

interface PageMetadataInput {
  title: string;
  description: string;
  path: `/${string}` | '/';
  index?: boolean;
  image?: SocialImage;
  keywords?: string[];
}

export const createPageMetadata = ({
  title,
  description,
  path,
  index = true,
  image = DEFAULT_SOCIAL_IMAGE,
  keywords,
}: PageMetadataInput): Metadata => {
  const openGraphImage = {
    ...image,
    alt: image.alt ?? `${title} social preview`,
  };

  return ({
  title,
  description,
  ...(keywords?.length ? { keywords } : {}),
  alternates: { canonical: path },
  robots: index ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: {
    title,
    description,
    url: path,
    images: [openGraphImage],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [image.url],
  },
  });
};

export interface RootSiteMetadataInput {
  brandName: string;
  homepageTitle: string;
  homepageDescription: string;
  searchKeywords: string[];
  socialImage: {
    url: string;
    width: number;
    height: number;
    alt: string;
  };
  faviconUrl: string;
  metadataBase: URL;
}

export const createRootSiteMetadata = ({
  brandName,
  homepageTitle,
  homepageDescription,
  searchKeywords,
  socialImage,
  faviconUrl,
  metadataBase,
}: RootSiteMetadataInput): Metadata => {
  // Older Website Editions retain the original bundled SVG identity. Resolve
  // that one known asset to its identical raster export; custom media stays owned.
  const iconUrl = faviconUrl === '/brand/cardforge-studio/favicon.svg'
    ? '/brand/cardforge-studio/favicon.png' : faviconUrl;
  return ({
  metadataBase,
  title: {
    default: `${brandName} | ${homepageTitle}`,
    template: `%s | ${brandName}`,
  },
  description: homepageDescription,
  keywords: searchKeywords,
  icons: {
    icon: iconUrl,
    shortcut: iconUrl,
    apple: iconUrl,
  },
  openGraph: {
    siteName: brandName,
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    images: [socialImage.url],
  },
});
};
