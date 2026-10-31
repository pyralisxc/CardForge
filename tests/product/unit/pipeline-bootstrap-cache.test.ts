import { expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => ({
  bootstrap: vi.fn(async () => ({ templates: { defaults: [], userTemplates: [] }, styles: { styles: [] }, fonts: { fonts: [] }, pipeline: [{ assetId: 'exact-asset', submissionId: '10000000-0000-4000-8000-000000000001' }] })),
  legacyCacheReads: [] as string[],
}));
vi.mock('@/features/pipeline/lib/catalogManifest', () => ({ getCardForgeCatalogManifest: vi.fn(), getCardForgeStudioAssetManifest: vi.fn(), getCardForgeStudioBootstrapManifest: provider.bootstrap }));
vi.mock('next/cache', () => ({
  // Model a Data Cache entry retained from before the source projection shipped.
  unstable_cache: (read: () => unknown, keys: string[]) => async () => {
    if (keys[0] === 'cardforge-studio-bootstrap' && keys[1] === 'registry-model-v4') {
      provider.legacyCacheReads.push(keys.join(':'));
      return { templates: { defaults: [], userTemplates: [] }, styles: { styles: [] }, fonts: { fonts: [] } };
    }
    return read();
  }, revalidateTag: vi.fn(),
}));
import { getCachedCardForgeStudioBootstrap } from '@/features/pipeline/server/catalogCache';
it('does not reuse a retained bootstrap cache entry that predates exact source pointers', async () => {
  const bootstrap = await getCachedCardForgeStudioBootstrap('free');
  expect(bootstrap.pipeline).toEqual([{ assetId: 'exact-asset', submissionId: '10000000-0000-4000-8000-000000000001' }]);
  expect(provider.bootstrap).toHaveBeenCalledOnce(); expect(provider.legacyCacheReads).toEqual([]);
});
