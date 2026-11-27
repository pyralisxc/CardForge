import { beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ account: vi.fn(), profile: vi.fn(), upsert: vi.fn() }));
vi.mock('@/features/account/server', () => ({
  getCurrentAccountToolAccess: f.account,
  AccountToolAccessError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
vi.mock('@/features/contributor-access/server/profileStore', () => ({
  getContributorProfileCapabilities: f.profile, upsertContributorProfile: f.upsert,
}));
vi.mock('@/features/contributor-access/server', async () => import('@/features/contributor-access/server/access'));

import { AccountToolAccessError } from '@/features/account/server';
import { GET } from '@/app/api/contributor-access/route';

describe('Contributor access endpoint', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    f.account.mockResolvedValue({ user: { id: 'contributor' }, entitlement: { authorities: { contributor: true } }, isOwner: false });
    f.upsert.mockResolvedValue(undefined);
    f.profile.mockResolvedValue({ status: 'inactive', canDraftCampaigns: false });
  });

  it('returns an inactive projection only when the profile is actually inactive', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: false, scopes: [] });
  });

  it('preserves a signed-out response instead of reporting an inactive profile', async () => {
    f.account.mockRejectedValue(new AccountToolAccessError('Sign in again.', 401));
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'sign_in_required' } });
    expect(f.profile).not.toHaveBeenCalled();
  });

  it('reports an unavailable profile store as unavailable', async () => {
    f.profile.mockRejectedValue(new Error('unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { expect((await GET()).status).toBe(503); } finally { log.mockRestore(); }
  });
});
