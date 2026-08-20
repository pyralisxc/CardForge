import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createPageMetadata } from '@/shared/siteMetadata';

const readRoute = (route: string): string => readFileSync(
  join(process.cwd(), 'src/app', route, 'page.tsx'),
  'utf8',
);

describe('site metadata', () => {
  it('keeps root metadata on server-safe feature interfaces', () => {
    const rootLayout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

    expect(rootLayout).toContain("from '@/features/business-identity/server'");
    expect(rootLayout).not.toContain("from '@/features/brand-presentation/client'");
  });

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

  it('marks every private or application route noindex', () => {
    for (const route of ['studio', 'account', 'owner', 'profile', 'creator-pool']) {
      const source = readRoute(route);
      expect(source, route).toContain('index: false');
    }
  });

  it('keeps archived Creator Pool language out of primary marketing pages', () => {
    for (const route of ['page.tsx']) {
      const source = readFileSync(join(process.cwd(), 'src/app', route), 'utf8');
      expect(source).not.toContain('href="/creator-pool"');
      expect(source).not.toContain('Creator Pool Notice');
    }
  });
});
