import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/legal/server', () => ({}));
vi.mock('@/features/roadmap/server', () => ({}));
vi.mock('@/features/business-identity/server', () => ({}));
vi.mock('@/features/experience-settings/server', () => ({}));
const state = vi.hoisted(() => ({ fail: '', restore: vi.fn(), current: 'new-image' }));
vi.mock('next/cache', () => ({ revalidatePath: () => { if (state.fail === 'path') throw new Error('Path refresh failed'); } }));
vi.mock('@/features/owner/server', () => ({
  getCurrentOwnerAccess: async () => ({ isOwner: true, userId: 'owner_fixture', email: 'owner@example.test' }),
}));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({
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
  SiteMediaStoreError: class extends Error { constructor(message: string, public status = 503) { super(message); } },
  restorePreviousSiteMedia: async () => {
    if (state.fail === 'commit') throw new Error('Database unavailable');
    if (state.current !== 'new-image') throw new Error('Stale revision');
    state.restore(); state.current = state.current === 'new-image' ? 'old-image' : 'new-image';
    return { slot: 'landing.hero', label: 'Hero image', updatedAt: 'committed-revision' };
  },
  revalidateSiteMediaCache: () => { if (state.fail === 'cache') throw new Error('Cache unavailable'); },
}));
vi.mock('@/infrastructure/security/abuseProtection', () => ({
  consumeRateLimit: async () => ({ allowed: true }), RateLimitUnavailableError: class extends Error {},
}));
import { POST } from '@/app/api/owner/site-media/[slot]/restore/route';
const restore = () => POST(new Request('https://fixture.test/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: 'initiating-revision' }) }), { params: Promise.resolve({ slot: 'landing.hero' }) });
beforeEach(() => { vi.clearAllMocks(); state.fail = ''; state.current = 'new-image'; });
describe('image restore committed receipt', () => {
  it.each(['cache', 'path'])('does not invite a second toggling restore after %s failure', async (failure) => {
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
    expect(await response.json()).toMatchObject({ restore: { committed: true, refresh: 'complete', retryable: false }, media: { updatedAt: 'committed-revision' } });
  });
  it.each(['activity', 'activity-false'])('reports committed restoration when %s fails', async (failure) => {
    state.fail = failure;
    const response = await restore();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ receipt: { committed: true, activityRecorded: false, retryable: false }, media: { updatedAt: 'committed-revision' } });
    expect(state.restore).toHaveBeenCalledTimes(1);
  });
  it('preserves an actual precommit failure without claiming restoration', async () => {
    state.fail = 'commit';
    const response = await restore();
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty('restore');
    expect(state.current).toBe('new-image');
  });
});
