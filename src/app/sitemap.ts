import type { MetadataRoute } from 'next';

import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicAppUrl();
  const settings = await getCachedPublicSiteConfiguration();

  return [...publicRoutes, ...(settings.pages ?? []).filter((page) => page.published).map((page) => '/' + page.slug)].map((route) => ({
    url: `${siteUrl}${route}`,
  }));
}
