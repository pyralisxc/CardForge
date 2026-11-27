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

const request = (readOnly = false) => new Request(`http://localhost/api/contributor-access${readOnly ? '?readOnly=1' : ''}`);

describe('Contributor access endpoint', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    f.account.mockResolvedValue({ user: { id: 'contributor' }, entitlement: { authorities: { contributor: true } }, isOwner: false });
    f.upsert.mockResolvedValue(undefined);
    f.profile.mockResolvedValue({ status: 'inactive', canDraftCampaigns: false });
  });

  it.each(['inactive', 'suspended'])('reads a %s profile without changing it', async (status) => {
    f.profile.mockResolvedValue({ status, canDraftCampaigns: false });
    const response = await GET(request(true));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: false, scopes: [] });
    expect(f.upsert).not.toHaveBeenCalled();
  });

  it('reads an active profile without enrolling or updating it', async () => {
    f.profile.mockResolvedValue({ status: 'active', canDraftCampaigns: false });
    const response = await GET(request(true));
    expect(await response.json()).toMatchObject({ active: true, scopes: expect.arrayContaining(['assets.review']) });
    expect(f.upsert).not.toHaveBeenCalled();
  });

  it('retains the existing enrollment path for ordinary access requests', async () => {
    f.profile.mockResolvedValue({ status: 'active', canDraftCampaigns: false });
    expect((await GET(request())).status).toBe(200);
    expect(f.upsert).toHaveBeenCalledOnce();
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({ contributorId: 'contributor' }));
  });

  it('preserves a signed-out response instead of reporting an inactive profile', async () => {
    f.account.mockRejectedValue(new AccountToolAccessError('Sign in again.', 401));
    const response = await GET(request(true));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'sign_in_required' } });
    expect(f.profile).not.toHaveBeenCalled();
  });

  it('reports an unavailable profile store as unavailable', async () => {
    f.profile.mockRejectedValue(new Error('unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { expect((await GET(request(true))).status).toBe(503); } finally { log.mockRestore(); }
  });
});
