import type { MetadataRoute } from 'next';

import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const publicRoutes = [
  '/',
  '/about',
  '/access',
  '/studio',
  '/account',
  '/developer',
  '/roadmap',
  '/privacy',
  '/terms',
  '/refund',
  '/developer-terms',
  '/creator-pool',
  '/contact',
];

const LAST_SITE_UPDATE = new Date('2026-07-12');

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicAppUrl();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: LAST_SITE_UPDATE,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/studio' ? 0.9 : 0.7,
  }));
}
