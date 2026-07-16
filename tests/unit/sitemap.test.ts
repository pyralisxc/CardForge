import { describe, expect, it, vi } from 'vitest';

import sitemap from '@/app/sitemap';

vi.mock('@/infrastructure/http/publicUrl', () => ({
  getPublicAppUrl: () => 'https://cardforges.com',
}));

describe('sitemap', () => {
  it('lists only crawlable public site URLs on the production host', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain('https://cardforges.com/');
    expect(urls).toContain('https://cardforges.com/studio');
    expect(urls).toContain('https://cardforges.com/developer');
    expect(urls).toContain('https://cardforges.com/privacy');
    expect(urls).not.toContain('https://cardforges.com/owner');
    expect(urls.some((url) => url.includes('/api/'))).toBe(false);
  });

  it('uses the current launch update date for sitemap freshness', () => {
    expect(sitemap().every((entry) => (
      entry.lastModified instanceof Date &&
      entry.lastModified.toISOString() === '2026-07-12T00:00:00.000Z'
    ))).toBe(true);
  });
});
