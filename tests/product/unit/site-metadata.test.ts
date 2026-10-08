import { describe, expect, it } from 'vitest';

import { createPageMetadata } from '@/shared/siteMetadata';

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