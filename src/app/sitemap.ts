import type { MetadataRoute } from 'next';

import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const publicRoutes = [
  '/',
  '/about',
  '/access',
  '/developer',
  '/roadmap',
  '/cameron',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicAppUrl();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
  }));
}
