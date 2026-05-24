import type { MetadataRoute } from 'next';

import { getPublicAppUrl } from '@/lib/siteUrl';

const publicRoutes = [
  '/',
  '/studio',
  '/account',
  '/developer',
  '/roadmap',
  '/privacy',
  '/terms',
  '/refund',
  '/contact',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicAppUrl();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date('2026-05-23'),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/studio' ? 0.9 : 0.7,
  }));
}
