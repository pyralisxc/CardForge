import type { MetadataRoute } from 'next';

import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const publicRoutes = [
  '/',
  '/about',
  '/plans',
  '/contributors',
  '/roadmap',
  '/cameron',
  '/contact',
  '/accessibility',
  '/privacy',
  '/terms',
  '/creator-pass-terms',
  '/supporter-terms',
  '/refund',
  '/contributor-terms',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicAppUrl();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
  }));
}
