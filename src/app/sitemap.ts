import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';

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
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date('2026-05-23'),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/studio' ? 0.9 : 0.7,
  }));
}
