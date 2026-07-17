import type { Metadata } from 'next';

const DEFAULT_SOCIAL_IMAGE = {
  url: '/card-assets/landing/cardforge-hero-workbench.png',
  width: 1600,
  height: 900,
  alt: 'CardForge Studio card-system workspace and finished card designs',
};

interface PageMetadataInput {
  title: string;
  description: string;
  path: `/${string}` | '/';
  index?: boolean;
  image?: typeof DEFAULT_SOCIAL_IMAGE;
}

export const createPageMetadata = ({
  title,
  description,
  path,
  index = true,
  image = DEFAULT_SOCIAL_IMAGE,
}: PageMetadataInput): Metadata => ({
  title,
  description,
  alternates: { canonical: path },
  robots: index ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: {
    title,
    description,
    url: path,
    siteName: 'CardForge Studio',
    images: [image],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [image.url],
  },
});
