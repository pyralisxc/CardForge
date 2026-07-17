import type { MetadataRoute } from 'next';

import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const publicRoutes = [
  '/',
  '/examples',
  '/about',
  '/access',
  '/developer',
  '/roadmap',
  '/cameron',
  '/support',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicAppUrl();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
  }));
}
