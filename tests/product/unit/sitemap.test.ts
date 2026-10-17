import { beforeEach, describe, expect, it, vi } from 'vitest';

import sitemap from '@/app/sitemap';
import * as sitemapRoute from '@/app/sitemap';

const state = vi.hoisted(() => ({ pages: [] as Array<{ slug: string; published: boolean }> }));
vi.mock('@/features/public-site/server', () => ({ getCachedPublicSiteConfiguration: async () => ({ pages: state.pages }) }));

vi.mock('@/infrastructure/http/publicUrl', () => ({
  getPublicAppUrl: () => 'https://cardforges.com',
}));

describe('sitemap', () => {
  beforeEach(() => { state.pages = []; });

  it('uses request-time metadata rather than a deployment-time route snapshot', () => {
    expect('dynamic' in sitemapRoute ? sitemapRoute.dynamic : undefined).toBe('force-dynamic');
  });

  it('reflects page publication and removal without exposing drafts', async () => {
    const url = 'https://cardforges.com/authoring-example';
    state.pages = [{ slug: 'authoring-example', published: false }];
    expect((await sitemap()).map((entry) => entry.url)).not.toContain(url);
    state.pages[0].published = true;
    expect((await sitemap()).map((entry) => entry.url)).toContain(url);
    state.pages = [];
    expect((await sitemap()).map((entry) => entry.url)).not.toContain(url);
  });

  it('lists only crawlable public site URLs on the production host', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toEqual([
      'https://cardforges.com/',
      'https://cardforges.com/about',
      'https://cardforges.com/plans',
      'https://cardforges.com/contributors',
      'https://cardforges.com/roadmap',
      'https://cardforges.com/cameron',
      'https://cardforges.com/contact',
      'https://cardforges.com/accessibility',
      'https://cardforges.com/privacy',
      'https://cardforges.com/terms',
      'https://cardforges.com/creator-pass-terms',
      'https://cardforges.com/supporter-terms',
      'https://cardforges.com/refund',
      'https://cardforges.com/contributor-terms',
    ]);
  });

  it('does not invent freshness or ranking hints', async () => {
    expect((await sitemap()).every((entry) => (
      entry.lastModified === undefined
      && entry.changeFrequency === undefined
      && entry.priority === undefined
    ))).toBe(true);
  });
});
