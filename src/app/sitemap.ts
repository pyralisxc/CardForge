import type { MetadataRoute } from 'next';

import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const publicRoutes = [
  '/',
  '/about',
  '/developer',
  '/roadmap',
  '/cameron',
  '/contact',
  '/accessibility',
  '/privacy',
  '/terms',
  '/creator-pass-terms',
  '/supporter-terms',
  '/refund',
  '/developer-terms',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicAppUrl();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
  }));
}
