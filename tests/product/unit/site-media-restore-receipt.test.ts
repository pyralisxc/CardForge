import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ fail: '', restore: vi.fn(), current: 'new-image' }));
vi.mock('next/cache', () => ({ revalidatePath: () => { if (state.fail === 'path') throw new Error('Path refresh failed'); } }));
vi.mock('@/features/owner/server', () => ({
  getCurrentOwnerAccess: async () => ({ isOwner: true, userId: 'owner_fixture', email: 'owner@example.test' }),
  recordOwnerActivity: async () => {
    if (state.fail === 'activity') throw new Error('History unavailable');
    return state.fail !== 'activity-false';
  },
  getOwnerSiteOperationsPayload: async () => {
    if (state.fail === 'payload') throw new Error('Payload unavailable');
    return { siteMedia: [] };
  },
}));
vi.mock('@/features/public-site/server', () => ({
  isSiteMediaSlot: (slot: string) => slot === 'landing.hero',
  SiteMediaStoreError: class extends Error {},
  restorePreviousSiteMedia: async () => {
    if (state.fail === 'commit') throw new Error('Database unavailable');
    state.restore(); state.current = state.current === 'new-image' ? 'old-image' : 'new-image';
  },
  revalidateSiteMediaCache: () => { if (state.fail === 'cache') throw new Error('Cache unavailable'); },
}));
vi.mock('@/infrastructure/security/abuseProtection', () => ({
  consumeRateLimit: async () => ({ allowed: true }), RateLimitUnavailableError: class extends Error {},
}));
import { POST } from '@/app/api/owner/site-media/[slot]/restore/route';
const restore = () => POST(new Request('https://fixture.test/restore', { method: 'POST' }), { params: Promise.resolve({ slot: 'landing.hero' }) });
beforeEach(() => { vi.clearAllMocks(); state.fail = ''; state.current = 'new-image'; });
describe('image restore committed receipt', () => {
  it.each(['cache', 'path', 'activity', 'activity-false', 'payload'])('does not invite a second toggling restore after %s failure', async (failure) => {
    state.fail = failure;
    const response = await restore();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ restore: {
      committed: true, slot: 'landing.hero', refresh: 'unavailable', retryable: false, nextAction: 'reload',
      message: expect.stringContaining('Do not repeat Restore'),
    } });
    expect(state.restore).toHaveBeenCalledTimes(1);
    expect(state.current).toBe('old-image');
  });
  it('returns the refreshed view with a successful receipt', async () => {
    const response = await restore();
    expect(await response.json()).toMatchObject({ restore: { committed: true, refresh: 'complete', retryable: false }, operations: { siteMedia: [] } });
  });
  it('preserves an actual precommit failure without claiming restoration', async () => {
    state.fail = 'commit';
    const response = await restore();
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty('restore');
    expect(state.current).toBe('new-image');
  });
});
