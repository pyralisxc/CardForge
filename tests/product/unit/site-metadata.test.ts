import { describe, expect, it } from 'vitest';

import { createPageMetadata, createRootSiteMetadata } from '@/shared/siteMetadata';

describe('site metadata', () => {
  it('creates a self-referencing canonical and matching Open Graph URL', () => {
    const metadata = createPageMetadata({
      title: 'About CardForge',
      description: 'How CardForge turns reusable templates and structured data into complete card sets.',
      path: '/about',
    });

    expect(metadata.alternates?.canonical).toBe('/about');
    expect(metadata.openGraph?.url).toBe('/about');
    expect(metadata.openGraph?.title).toBe('About CardForge');
    expect(metadata.openGraph?.images).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: expect.any(String), alt: expect.any(String) }),
    ]));
  });

  it('projects page-owned search phrases only when supplied by that page owner', () => {
    const metadata = createPageMetadata({
      title: 'CardForge',
      description: 'Create complete custom card Sets.',
      path: '/',
      keywords: ['custom card sets', 'printable card design'],
    });

    expect(metadata.keywords).toEqual(['custom card sets', 'printable card design']);

    const withoutKeywords = createPageMetadata({
      title: 'About CardForge',
      description: 'About CardForge.',
      path: '/about',
    });
    expect(withoutKeywords.keywords).toBeUndefined();
  });

  it('projects live root brand, search, social, and favicon identity from one bounded presentation', () => {
    const metadata = createRootSiteMetadata({
      brandName: 'CardForge Live',
      homepageTitle: 'Create complete Sets',
      homepageDescription: 'Owner-authored live homepage description.',
      searchKeywords: ['card sets', 'print cards'],
      socialImage: {
        url: '/api/public/site-media/brand.social?v=2026-10-08T22%3A00%3A00.000Z',
        width: 1600,
        height: 900,
        alt: 'Current CardForge social preview',
      },
      faviconUrl: '/api/public/site-media/brand.favicon?v=2026-10-08T22%3A00%3A00.000Z',
      metadataBase: new URL('https://cardforges.com'),
    });

    expect(metadata.title).toEqual({
      default: 'CardForge Live | Create complete Sets',
      template: '%s | CardForge Live',
    });
    expect(metadata.description).toBe('Owner-authored live homepage description.');
    expect(metadata.keywords).toEqual(['card sets', 'print cards']);
    expect(metadata.icons).toMatchObject({
      icon: expect.stringContaining('brand.favicon?v='),
      shortcut: expect.stringContaining('brand.favicon?v='),
      apple: expect.stringContaining('brand.favicon?v='),
    });
    expect(metadata.openGraph).toMatchObject({
      siteName: 'CardForge Live',
      images: [expect.objectContaining({
        url: expect.stringContaining('brand.social?v='),
        alt: 'Current CardForge social preview',
      })],
    });
  });

  it('creates explicit noindex metadata for application surfaces', () => {
    const metadata = createPageMetadata({
      title: 'CardForge Studio',
      description: 'The CardForge card-system workspace.',
      path: '/studio',
      index: false,
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe('/studio');
  });
});