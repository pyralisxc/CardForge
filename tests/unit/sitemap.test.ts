import { describe, expect, it, vi } from 'vitest';

import sitemap from '@/app/sitemap';

vi.mock('@/infrastructure/http/publicUrl', () => ({
  getPublicAppUrl: () => 'https://cardforges.com',
}));

describe('sitemap', () => {
  it('lists only crawlable public site URLs on the production host', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toEqual([
      'https://cardforges.com/',
      'https://cardforges.com/examples',
      'https://cardforges.com/about',
      'https://cardforges.com/access',
      'https://cardforges.com/developer',
      'https://cardforges.com/roadmap',
      'https://cardforges.com/cameron',
    ]);
  });

  it('does not invent freshness or ranking hints', () => {
    expect(sitemap().every((entry) => (
      entry.lastModified === undefined
      && entry.changeFrequency === undefined
      && entry.priority === undefined
    ))).toBe(true);
  });
});
