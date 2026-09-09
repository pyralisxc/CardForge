import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ locked: false, failWrite: false, updates: vi.fn(),
  metadata: {} as Record<string, unknown> }));
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: async () => ({ users: {
  getUser: async (id: string) => ({ id, firstName: 'Fixture', lastName: null, emailAddresses: [], privateMetadata: state.metadata, publicMetadata: {} }),
  updateUserMetadata: async (_id: string, patch: { privateMetadata: Record<string, unknown> }) => {
    if (state.failWrite) throw new Error('Clerk unavailable');
    state.updates(patch); state.metadata = patch.privateMetadata;
  },
} }) }));
vi.mock('@/features/billing/server', () => ({
  acquireBillingEntitlementLock: async () => { if (state.locked) return null; state.locked = true; return 'lease'; },
  releaseBillingEntitlementLock: async () => { state.locked = false; },
}));
vi.mock('@/features/account/server', () => import('@/features/account/server/accountAdministration'));
vi.mock('@/features/contributor-access/server', async () => ({
  ...(await import('@/features/contributor-access/server/profileStore')),
  CONTRIBUTOR_PROFILE_STATUSES: ['active', 'inactive', 'suspended', 'invited'],
  fetchContributorProfileRows: async () => [],
}));
vi.mock('@/features/owner/server', () => ({
  getCurrentOwnerAccess: async () => ({ isOwner: true, userId: 'owner_one', email: 'owner@example.test' }),
  getOwnerPeople: vi.fn(), recordOwnerActivity: async () => true,
}));
import { PATCH } from '@/app/api/owner/people/route';

const request = () => new Request('https://fixture.test/api/owner/people', {
  method: 'PATCH', body: JSON.stringify({ userId: 'user_one', account: { commercialPlan: 'free', contributor: false, owner: false } }),
});
beforeEach(() => {
  vi.clearAllMocks(); state.locked = false; state.failWrite = false;
  state.metadata = { cardforgeStripeSubscriptionId: 'sub_creator', cardforgePaidPlan: 'creator', cardforgeOwnerCommercialPlan: 'designer', cardforgeCommercialPlan: 'designer', cardforgeAccess: 'paid' };
});
describe('owner grants share the Stripe projection lock', () => {
  it('removes an extra grant without canceling paid access', async () => {
    expect((await PATCH(request())).status).toBe(200);
    expect(state.metadata).toMatchObject({ cardforgeOwnerCommercialPlan: 'free', cardforgeCommercialPlan: 'creator', cardforgeAccess: 'paid' });
    expect(state.locked).toBe(false);
  });
  it('refuses an owner write during webhook projection', async () => {
    state.locked = true;
    const response = await PATCH(request());
    expect(response.status).toBe(409);
    expect(state.updates).not.toHaveBeenCalled();
    expect(state.locked).toBe(true);
  });
  it('releases its lock without reporting success after a Clerk failure', async () => {
    state.failWrite = true;
    expect((await PATCH(request())).status).toBe(500);
    expect(state.locked).toBe(false);
    expect(state.metadata.cardforgeOwnerCommercialPlan).toBe('designer');
  });
});
