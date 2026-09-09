import { beforeEach, describe, expect, it, vi } from 'vitest';

const provider = vi.hoisted(() => ({ configured: true, error: null as unknown, data: [] as unknown,
  reads: vi.fn(), writes: vi.fn(), invalidate: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (read: () => unknown) => read, revalidateTag: provider.invalidate }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerConfigStatus: () => ({ configured: provider.configured }),
  getSupabaseServerClient: () => {
    if (!provider.configured) return null;
    const query = {
      select: () => { provider.reads(); return query; }, order: () => query, eq: () => query,
      limit: () => query, maybeSingle: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: provider.data, error: provider.error }).then(resolve),
      upsert: async (row: unknown) => { provider.writes(row); return { error: null }; },
    };
    return { from: () => query };
  },
}));
import { getSiteContentBlocks, updateSiteContentBlock } from '@/features/public-site/server/contentStore';
import { getSiteMedia, updateSiteMedia } from '@/features/public-site/server/siteMediaStore';
import { getFounderProfile } from '@/features/public-site/server/founderProfileStore';
import { getPublicSiteConfiguration } from '@/features/public-site/server/siteConfigurationStore';
import { revalidateSiteContentCache } from '@/features/public-site/server/publicContentCache';
import { revalidateSiteMediaCache } from '@/features/public-site/server/publicSiteMediaCache';
import { revalidateFounderProfile } from '@/features/public-site/server/founderProfileCache';
import { revalidatePublicSiteConfiguration } from '@/features/public-site/server/publicSiteConfigurationCache';
import { DEFAULT_SITE_CONTENT_BLOCKS } from '@/features/public-site/model/siteContent';
import { DEFAULT_SITE_MEDIA } from '@/features/public-site/model/siteMedia';

const readers = [getSiteContentBlocks, getSiteMedia, getFounderProfile, getPublicSiteConfiguration];
const invalidators = [revalidateSiteContentCache, revalidateSiteMediaCache, revalidateFounderProfile, revalidatePublicSiteConfiguration];
beforeEach(() => { vi.clearAllMocks(); provider.invalidate.mockReset(); provider.configured = true; provider.error = null; provider.data = []; });
describe('public content cache inputs', () => {
  it.each(readers.map((read, index) => ({ read, index })))('keeps unconfigured local defaults ($index)', async ({ read }) => {
    provider.configured = false;
    await expect(read()).resolves.toBeDefined();
    expect(provider.reads).not.toHaveBeenCalled();
  });
  it.each(readers.map((read, index) => ({ read, index })))('rejects configured-provider outages instead of caching defaults ($index)', async ({ read }) => {
    provider.error = { message: 'fixture timeout' };
    await expect(read()).rejects.toMatchObject({ status: 503 });
    provider.error = { code: '42P01', message: 'relation does not exist' };
    await expect(read()).rejects.toMatchObject({ status: 503 });
  });
  it('reads edited copy after recovery and never replaces it with fallback on error', async () => {
    const slug = DEFAULT_SITE_CONTENT_BLOCKS[0].slug;
    provider.data = [{ slug, body: 'Owner-authored fixture copy', updated_at: '2026-09-09T00:00:00Z' }];
    expect((await getSiteContentBlocks()).find((block) => block.slug === slug)?.body).toBe('Owner-authored fixture copy');
    provider.error = { message: 'fixture outage' };
    await expect(getSiteContentBlocks()).rejects.toMatchObject({ status: 503 });
    provider.error = null;
    expect((await getSiteContentBlocks()).find((block) => block.slug === slug)?.body).toBe('Owner-authored fixture copy');
  });
  it('acknowledges a copy write without a fallible post-write reread', async () => {
    provider.error = { message: 'reads unavailable after save' };
    await updateSiteContentBlock({ slug: DEFAULT_SITE_CONTENT_BLOCKS[0].slug, body: 'Updated copy for the fixture.' });
    expect(provider.writes).toHaveBeenCalledTimes(1);
    expect(provider.reads).not.toHaveBeenCalled();
  });
  it('does not misreport a committed image as uncommitted when subsequent reads fail', async () => {
    const image = DEFAULT_SITE_MEDIA[0];
    provider.writes.mockImplementation(() => { provider.error = { message: 'read outage after commit' }; });
    await updateSiteMedia({ slot: image.slot, storagePath: null, alt: 'Fixture image', width: null, height: null, presentation: image.presentation });
    expect(provider.writes).toHaveBeenCalledTimes(1);
    expect(provider.reads).toHaveBeenCalledTimes(1);
  });
  it.each(invalidators.map((invalidate, index) => ({ invalidate, index })))('reports saved-but-cache-refresh-failed to the owner ($index)', ({ invalidate }) => {
    provider.invalidate.mockImplementation(() => { throw new Error('fixture invalidation failure'); });
    expect(invalidate).toThrow(/saved.*cache/);
  });
});
