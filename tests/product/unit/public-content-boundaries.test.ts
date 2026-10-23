import { beforeEach, describe, expect, it, vi } from 'vitest';

const provider = vi.hoisted(() => ({ configured: true, error: null as unknown, data: [] as unknown, tables: {} as Record<string, unknown>,
  reads: vi.fn(), writes: vi.fn(), invalidate: vi.fn(), rpc: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (read: () => unknown) => read, revalidateTag: provider.invalidate }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerConfigStatus: () => ({ configured: provider.configured }),
  getSupabaseServerClient: () => {
    if (!provider.configured) return null;
    const makeQuery = (table: string) => { const query = {
      select: () => { provider.reads(table); return query; }, order: () => query, eq: () => query,
      limit: () => query, maybeSingle: () => query,
      update: (row: unknown) => { provider.writes(row); const writeQuery = { eq: () => writeQuery, is: () => writeQuery, select: () => writeQuery, maybeSingle: async () => ({ data: row, error: null }) }; return writeQuery; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: provider.tables[table] ?? provider.data, error: provider.error }).then(resolve),
      upsert: async (row: unknown) => { provider.writes(row); return { error: null }; },
    };
    return query; };
    return { from: makeQuery, rpc: provider.rpc };
  },
}));
const edition = vi.hoisted(() => ({ live: { revisionId: null as string | null, generation: 0 }, read: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/features/public-site/server/websiteEditionStore', () => ({
  readLiveWebsiteRevision: async () => edition.live,
  readWebsiteRevision: (...args: unknown[]) => edition.read(...args),
  WebsiteEditionStoreError: class extends Error { constructor(message: string, public status = 503) { super(message); } },
}));

import {
  getSiteContentBlocks,
  publishSiteContentBlockRevision,
  updateSiteContentBlock,
} from '@/features/public-site/server/contentStore';
import { getSiteMedia, updateSiteMedia } from '@/features/public-site/server/siteMediaStore';
import { getFounderProfile } from '@/features/public-site/server/founderProfileStore';
import { getPublicSiteConfiguration } from '@/features/public-site/server/siteConfigurationStore';
import { getCachedAllSiteContentBlocks, getCachedSiteContentBlocks, revalidateSiteContentCache } from '@/features/public-site/server/publicContentCache';
import { getCachedSiteMedia, revalidateSiteMediaCache } from '@/features/public-site/server/publicSiteMediaCache';
import { getCachedFounderProfile, revalidateFounderProfile } from '@/features/public-site/server/founderProfileCache';
import { getCachedPublicSiteConfiguration, revalidatePublicSiteConfiguration } from '@/features/public-site/server/publicSiteConfigurationCache';
import { DEFAULT_SITE_CONTENT_BLOCKS } from '@/features/public-site/model/siteContent';
import { DEFAULT_SITE_MEDIA, getDefaultSiteMedia } from '@/features/public-site/model/siteMedia';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION, completePublicSiteConfiguration } from '@/features/public-site/model/siteConfiguration';
import { DEFAULT_FOUNDER_PROFILE } from '@/features/public-site/model/founderProfile';

const readers = [getSiteContentBlocks, getSiteMedia, getFounderProfile, getPublicSiteConfiguration];
const invalidators = [revalidateSiteContentCache, revalidateSiteMediaCache, revalidateFounderProfile, revalidatePublicSiteConfiguration];
beforeEach(() => {
  vi.clearAllMocks();
  provider.invalidate.mockReset();
  provider.rpc.mockReset();
  provider.configured = true;
  provider.error = null;
  provider.data = [];
  provider.tables = {};
  edition.live = { revisionId: null, generation: 0 };
  edition.read.mockReset();
});
describe('public content cache inputs', () => {
  it('uses the real resolver and fails closed on an unreadable activated revision', async () => {
    const { resolveLiveWebsitePresentation } = await import('@/features/public-site/server/websitePresentationResolver');
    provider.error = { code: 'PGRST303', message: 'legacy provider unavailable' };
    await expect(resolveLiveWebsitePresentation()).resolves.toMatchObject({
      revisionId: null,
      content: DEFAULT_SITE_CONTENT_BLOCKS,
    });
    edition.live = { revisionId: '10000000-0000-4000-8000-000000000001', generation: 1 };
    edition.read.mockRejectedValue(new Error('saved revision temporarily unavailable'));
    await expect(resolveLiveWebsitePresentation()).rejects.toThrow('saved revision temporarily unavailable');
    expect(edition.read).toHaveBeenCalled();
  });

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
  it('adopts projected presentation with every raw copy and media concurrency token from the same reads', async () => {
    const epoch = '2026-08-31T02:48:22.771467Z';
    const slug = DEFAULT_SITE_CONTENT_BLOCKS[0].slug;
    provider.tables = {
      cardforge_site_content_blocks: [
        { slug, body: 'Current authored copy', updated_at: epoch },
        { slug: 'contributor.lane.site.body', body: 'Retained historical body', updated_at: epoch },
        { slug: 'contributor.lane.site.title', body: 'Retained historical title', updated_at: epoch },
      ],
      cardforge_site_media: [{ slot: 'landing.retired', updated_at: epoch }],
    };
    const original = structuredClone(provider.tables);
    const revisionId = '10000000-0000-4000-8000-000000000001';
    provider.rpc.mockResolvedValue({ data: revisionId, error: null });
    const { initializeWebsiteEditions } = await vi.importActual<typeof import('@/features/public-site/server/websiteEditionStore')>('@/features/public-site/server/websiteEditionStore');
    await expect(initializeWebsiteEditions('owner', '20000000-0000-4000-8000-000000000002')).resolves.toBe(revisionId);
    const [name, input] = provider.rpc.mock.calls[0];
    expect(name).toBe('cardforge_website_initialize');
    expect(input.p_copy_epochs).toEqual({
      [slug]: epoch, 'contributor.lane.site.body': epoch, 'contributor.lane.site.title': epoch,
    });
    expect(input.p_media_epochs).toEqual({ 'landing.retired': epoch });
    expect(input.p_manifest.content.find((block: { slug: string }) => block.slug === slug).body).toBe('Current authored copy');
    expect(input.p_manifest.content.some((block: { slug: string }) => block.slug.startsWith('contributor.lane.site.'))).toBe(false);
    expect(input.p_manifest.media.some((asset: { slot: string }) => asset.slot === 'landing.retired')).toBe(false);
    expect(provider.reads.mock.calls.filter(([table]) => table === 'cardforge_site_content_blocks')).toHaveLength(1);
    expect(provider.reads.mock.calls.filter(([table]) => table === 'cardforge_site_media')).toHaveLength(1);
    expect(provider.tables).toEqual(original);
    expect(provider.writes).not.toHaveBeenCalled();
  });

  it.each(['edit', 'addition', 'deletion'])('preserves the read snapshot and reports a bootstrap CAS conflict after a concurrent %s', async (change) => {
    const slug = DEFAULT_SITE_CONTENT_BLOCKS[0].slug;
    const epoch = '2026-08-31T02:48:22.771467Z';
    provider.tables.cardforge_site_content_blocks = [{ slug, body: 'Snapshot copy', updated_at: epoch }];
    provider.rpc.mockImplementation((_name, input) => {
      // Model provider state changing after the read, without accepting new tokens
      // for the earlier presentation. SQL remains the authoritative CAS owner.
      provider.tables.cardforge_site_content_blocks = change === 'deletion' ? [] : [
        { slug, body: change === 'edit' ? 'Concurrent copy' : 'Snapshot copy',
          updated_at: change === 'edit' ? '2026-10-23T21:00:00Z' : epoch },
        ...(change === 'addition' ? [{ slug: 'historical.new', body: 'New row', updated_at: epoch }] : []),
      ];
      expect(input.p_copy_epochs).toEqual({ [slug]: epoch });
      expect(input.p_manifest.content.find((block: { slug: string }) => block.slug === slug).body).toBe('Snapshot copy');
      return { data: null, error: { message: 'website_bootstrap_conflict' } };
    });
    const { initializeWebsiteEditions } = await vi.importActual<typeof import('@/features/public-site/server/websiteEditionStore')>('@/features/public-site/server/websiteEditionStore');
    await expect(initializeWebsiteEditions('owner', '20000000-0000-4000-8000-000000000002')).rejects.toMatchObject({ status: 409 });
    expect(provider.reads.mock.calls.filter(([table]) => table === 'cardforge_site_content_blocks')).toHaveLength(1);
    expect(provider.rpc).toHaveBeenCalledTimes(1);
    expect(provider.writes).not.toHaveBeenCalled();
  });

  it('does not attempt adoption when the source read fails', async () => {
    provider.error = { message: 'source unavailable' };
    const { initializeWebsiteEditions } = await vi.importActual<typeof import('@/features/public-site/server/websiteEditionStore')>('@/features/public-site/server/websiteEditionStore');
    await expect(initializeWebsiteEditions('owner', '20000000-0000-4000-8000-000000000002')).rejects.toMatchObject({ status: 503 });
    expect(provider.rpc).not.toHaveBeenCalled();
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
  it('uses compiled public copy per request without caching it when the provider is transiently unavailable', async () => {
    provider.error = { code: 'PGRST303', message: 'JWT issued at future' };
    await expect(getCachedAllSiteContentBlocks()).resolves.toEqual(DEFAULT_SITE_CONTENT_BLOCKS);
    await expect(getCachedSiteContentBlocks('contributor')).resolves.toEqual(
      DEFAULT_SITE_CONTENT_BLOCKS.filter((block) => block.group === 'contributor'),
    );
    expect(provider.reads).toHaveBeenCalledTimes(6); // each standalone call resolves three legacy owners before first activation
  });
  it('keeps public media, configuration, and founder rendering available during transient provider auth failures', async () => {
    provider.error = { code: 'PGRST303', message: 'JWT issued at future' };
    await expect(getCachedSiteMedia()).resolves.toEqual(
      DEFAULT_SITE_MEDIA.map((asset) => getDefaultSiteMedia(asset.slot)),
    );
    await expect(getCachedPublicSiteConfiguration()).resolves.toEqual(
      completePublicSiteConfiguration(DEFAULT_PUBLIC_SITE_CONFIGURATION),
    );
    await expect(getCachedFounderProfile()).resolves.toEqual(DEFAULT_FOUNDER_PROFILE);
    expect(provider.reads).toHaveBeenCalledTimes(7); // two three-owner resolutions plus founder
  });
  it('acknowledges a copy write without a fallible post-write reread', async () => {
    provider.error = { message: 'reads unavailable after save' };
    await updateSiteContentBlock({ slug: DEFAULT_SITE_CONTENT_BLOCKS[0].slug, body: 'Updated copy for the fixture.' });
    expect(provider.writes).toHaveBeenCalledTimes(1);
    expect(provider.reads).not.toHaveBeenCalled();
  });
  it('publishes site copy only against the exact revision the caller read', async () => {
    const slug = DEFAULT_SITE_CONTENT_BLOCKS[0].slug;
    provider.rpc.mockResolvedValue({
      data: [{ slug, body: 'Revision-safe copy', updated_at: '2026-10-08T20:40:00.000Z' }],
      error: null,
    });

    await expect(publishSiteContentBlockRevision({
      slug,
      body: 'Revision-safe copy',
      expectedUpdatedAt: '2026-10-08T20:30:00.000Z',
    })).resolves.toMatchObject({
      slug,
      body: 'Revision-safe copy',
      updatedAt: '2026-10-08T20:40:00.000Z',
    });
    expect(provider.rpc).toHaveBeenCalledWith('cardforge_publish_site_content_block', {
      p_slug: slug,
      p_body: 'Revision-safe copy',
      p_expected_updated_at: '2026-10-08T20:30:00.000Z',
    });
  });

  it('passes a proven missing revision as null for first publication', async () => {
    const slug = 'landing.showcase.stage.templates';
    provider.rpc.mockResolvedValue({
      data: [{ slug, body: 'Design in context', updated_at: '2026-10-17T06:00:00.000Z' }],
      error: null,
    });

    await expect(publishSiteContentBlockRevision({
      slug, body: 'Design in context', expectedUpdatedAt: null,
    })).resolves.toMatchObject({ slug, body: 'Design in context' });
    expect(provider.rpc).toHaveBeenCalledWith('cardforge_publish_site_content_block', {
      p_slug: slug, p_body: 'Design in context', p_expected_updated_at: null,
    });
  });

  it('turns a stale site-copy revision into a conflict instead of overwriting newer Owner state', async () => {
    provider.rpc.mockResolvedValue({
      data: null,
      error: { message: 'site_content_conflict' },
    });

    await expect(publishSiteContentBlockRevision({
      slug: DEFAULT_SITE_CONTENT_BLOCKS[0].slug,
      body: 'Stale proposed copy',
      expectedUpdatedAt: '2026-10-08T20:20:00.000Z',
    })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/changed after it was read/i),
    });
  });

  it('does not misreport a committed image as uncommitted when subsequent reads fail', async () => {
    const image = DEFAULT_SITE_MEDIA[0];
    provider.writes.mockImplementation(() => { provider.error = { message: 'read outage after commit' }; });
    await updateSiteMedia({ slot: image.slot, storagePath: null, alt: 'Fixture image', width: null, height: null, presentation: image.presentation, expectedUpdatedAt: null });
    expect(provider.writes).toHaveBeenCalledTimes(1);
    expect(provider.reads).toHaveBeenCalledTimes(1);
  });
  it.each(invalidators.map((invalidate, index) => ({ invalidate, index })))('reports saved-but-cache-refresh-failed to the owner ($index)', ({ invalidate }) => {
    provider.invalidate.mockImplementation(() => { throw new Error('fixture invalidation failure'); });
    expect(invalidate).toThrow(/saved.*cache/);
  });
});