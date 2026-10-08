import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestSiteMediaAsset = {
  slot: string;
  storagePath: string | null;
  defaultSrc: string | null;
  updatedAt: string | null;
};

const state = vi.hoisted(() => ({
  asset: {
    slot: 'brand.social',
    storagePath: 'brand/social/current.webp',
    defaultSrc: '/site-fallbacks/landing/cardforge-hero-workbench.png',
    updatedAt: '2026-10-08T20:00:00.000Z',
  } as TestSiteMediaAsset,
  download: vi.fn(),
}));

vi.mock('@/features/public-site/server', () => ({
  getCachedSiteMedia: async () => [state.asset],
  getDefaultSiteMedia: (slot: string) => ({
    slot,
    storagePath: null,
    defaultSrc: slot === 'brand.favicon'
      ? '/brand/cardforge-studio/favicon.svg'
      : '/site-fallbacks/landing/cardforge-hero-workbench.png',
    updatedAt: null,
  }),
  getSiteMediaContentType: (slot: string) => slot === 'brand.favicon' ? 'image/png' : 'image/webp',
  isSiteMediaSlot: (slot: string) => ['brand.social', 'brand.favicon', 'landing.hero'].includes(slot),
  SITE_MEDIA_BUCKET: 'cardforge-public-media',
}));

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: () => ({
    storage: {
      from: () => ({
        download: state.download,
      }),
    },
  }),
}));

import { GET } from '@/app/api/public/site-media/[slot]/route';

const get = (
  slot: string,
  {
    query = '',
    headers,
  }: {
    query?: string;
    headers?: HeadersInit;
  } = {},
) => GET(
  new Request(`https://cardforges.com/api/public/site-media/${slot}${query}`, { headers }),
  { params: Promise.resolve({ slot }) },
);

describe('public site media cache identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.asset = {
      slot: 'brand.social',
      storagePath: 'brand/social/current.webp',
      defaultSrc: '/site-fallbacks/landing/cardforge-hero-workbench.png',
      updatedAt: '2026-10-08T20:00:00.000Z',
    };
    state.download.mockResolvedValue({
      data: new Blob(['fixture'], { type: 'image/webp' }),
      error: null,
    });
  });

  it('requires crawler-facing stable social aliases to revalidate against a revision ETag', async () => {
    const first = await get('brand.social');
    const etag = first.headers.get('etag');

    expect(first.status).toBe(200);
    expect(etag).toMatch(/^"cf-site-media-[a-f0-9]{24}"$/u);
    expect(first.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(state.download).toHaveBeenCalledTimes(1);

    state.download.mockClear();
    const unchanged = await get('brand.social', {
      headers: { 'If-None-Match': etag! },
    });

    expect(unchanged.status).toBe(304);
    expect(unchanged.headers.get('etag')).toBe(etag);
    expect(state.download).not.toHaveBeenCalled();
  });

  it('changes the stable alias ETag when the Owner media revision changes', async () => {
    const first = await get('brand.social');
    const previousEtag = first.headers.get('etag');

    state.asset = {
      ...state.asset,
      storagePath: 'brand/social/next.webp',
      updatedAt: '2026-10-08T21:00:00.000Z',
    };
    const next = await get('brand.social', {
      headers: { 'If-None-Match': previousEtag! },
    });

    expect(next.status).toBe(200);
    expect(next.headers.get('etag')).not.toBe(previousEtag);
    expect(state.download).toHaveBeenCalledTimes(2);
  });

  it('keeps explicit version URLs immutable', async () => {
    const response = await get('brand.social', { query: '?v=revision-123' });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('gives the stable favicon fallback alias the same revision-aware revalidation contract', async () => {
    state.asset = {
      slot: 'brand.favicon',
      storagePath: null,
      defaultSrc: '/brand/cardforge-studio/favicon.svg',
      updatedAt: null,
    };

    const response = await get('brand.favicon');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/brand/cardforge-studio/favicon.svg');
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(response.headers.get('etag')).toMatch(/^"cf-site-media-[a-f0-9]{24}"$/u);
  });
});