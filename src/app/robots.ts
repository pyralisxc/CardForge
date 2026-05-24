import type { MetadataRoute } from 'next';

import { getPublicAppUrl } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicAppUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
