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
      'https://cardforges.com/about',
      'https://cardforges.com/plans',
      'https://cardforges.com/developer',
      'https://cardforges.com/roadmap',
      'https://cardforges.com/cameron',
      'https://cardforges.com/contact',
      'https://cardforges.com/accessibility',
      'https://cardforges.com/privacy',
      'https://cardforges.com/terms',
      'https://cardforges.com/creator-pass-terms',
      'https://cardforges.com/supporter-terms',
      'https://cardforges.com/refund',
      'https://cardforges.com/developer-terms',
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
