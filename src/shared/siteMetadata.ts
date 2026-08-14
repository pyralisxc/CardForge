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
}

export const createPageMetadata = ({
  title,
  description,
  path,
  index = true,
  image = DEFAULT_SOCIAL_IMAGE,
}: PageMetadataInput): Metadata => {
  const openGraphImage = {
    ...image,
    alt: image.alt ?? `${title} social preview`,
  };

  return ({
  title,
  description,
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
