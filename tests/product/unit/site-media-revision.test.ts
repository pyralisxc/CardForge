import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultSiteMedia } from '@/features/public-site/model/siteMedia';
const state = vi.hoisted(() => ({ rows: [] as unknown[], committed: null as unknown, error: null as unknown, eq: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerConfigStatus: () => ({ configured: true }),
  getSupabaseServerClient: () => ({ from: () => {
    const query = { select: () => query, eq: (...args: unknown[]) => { state.eq(...args); return query; }, is: () => query,
      order: async () => ({ data: state.rows, error: null }), maybeSingle: async () => ({ data: state.committed, error: state.error }),
      update: (...args: unknown[]) => { state.update(...args); return query; }, insert: (...args: unknown[]) => { state.insert(...args); return query; } };
    return query;
  } }),
}));
import { restorePreviousSiteMedia } from '@/features/public-site/server/siteMediaStore';
const revision = '2026-10-14T00:00:00Z';
const presentation = getDefaultSiteMedia('landing.hero').presentation;
const current = { slot: 'landing.hero', storage_path: null, alt: 'Current', width: null, height: null, presentation,
  previous_storage_path: null, previous_alt: 'Previous', previous_width: null, previous_height: null, previous_presentation: presentation, previous_updated_at: '2026-10-13T00:00:00Z', updated_at: revision };
beforeEach(() => { vi.clearAllMocks(); state.rows = [current]; state.committed = null; state.error = null; });
describe('native media version guard', () => {
  it('rejects a race between read and write without inserting a replacement', async () => {
    await expect(restorePreviousSiteMedia('landing.hero', revision)).rejects.toMatchObject({ status: 409 });
    expect(state.eq).toHaveBeenCalledWith('updated_at', revision);
    expect(state.insert).not.toHaveBeenCalled();
  });
  it('returns the actual restored row and rejects replay before another swap', async () => {
    state.committed = { ...current, alt: 'Previous', updated_at: '2026-10-14T00:00:01Z' };
    expect(await restorePreviousSiteMedia('landing.hero', revision)).toMatchObject({ alt: 'Previous', updatedAt: '2026-10-14T00:00:01Z' });
    state.rows = [state.committed];
    await expect(restorePreviousSiteMedia('landing.hero', revision)).rejects.toMatchObject({ status: 409 });
    expect(state.update).toHaveBeenCalledTimes(1);
  });
});
