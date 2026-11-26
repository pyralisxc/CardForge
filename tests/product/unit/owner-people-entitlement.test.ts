import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  locked: false,
  failWrite: false,
  updates: vi.fn(),
  updateProfile: vi.fn(),
  profile: null as Record<string, unknown> | null,
  metadata: {} as Record<string, unknown>,
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    users: {
      getUser: async (id: string) => ({
        id,
        firstName: 'Fixture',
        lastName: null,
        emailAddresses: [],
        privateMetadata: state.metadata,
        publicMetadata: {},
      }),
      updateUserMetadata: async (_id: string, patch: { privateMetadata: Record<string, unknown> }) => {
        if (state.failWrite) throw new Error('Clerk unavailable');
        state.updates(patch);
        state.metadata = { ...state.metadata, ...patch.privateMetadata };
      },
    },
  }),
}));

vi.mock('@/features/billing/server', () => ({
  acquireBillingEntitlementLock: async () => {
    if (state.locked) return null;
    state.locked = true;
    return 'lease';
  },
  releaseBillingEntitlementLock: async () => {
    state.locked = false;
  },
}));

vi.mock('@/features/account/server', () => import('@/features/account/server/accountAdministration'));

vi.mock('@/features/contributor-access/server', async () => ({
  ...(await import('@/features/contributor-access/server/profileStore')),
  CONTRIBUTOR_PROFILE_STATUSES: ['active', 'inactive', 'suspended', 'invited'],
  fetchContributorProfileRows: async () => state.profile ? [state.profile] : [],
  updateContributorProfileControl: state.updateProfile,
  upsertContributorProfile: vi.fn(),
}));

vi.mock('@/features/owner/lib/serverOwnerAccess', () => ({
  getCurrentOwnerAccess: async () => ({
    isOwner: true,
    userId: 'owner_one',
    email: 'owner@example.test',
  }),
}));

vi.mock('@/features/owner/server/ownerActivityStore', () => ({
  recordOwnerActivity: async () => true,
}));

import {
  updateOwnerPerson,
} from '@/features/owner/server/ownerPeopleOperations';

const input = () => ({
  userId: 'user_one',
  account: {
    commercialPlan: 'free',
    contributor: false,
    owner: false,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.locked = false;
  state.failWrite = false;
  state.profile = null;
  state.metadata = {
    cardforgeStripeSubscriptionId: 'sub_creator',
    cardforgePaidPlan: 'creator',
    cardforgeOwnerCommercialPlan: 'designer',
    cardforgeCommercialPlan: 'designer',
    cardforgeAccess: 'paid',
  };
});

describe('owner grants share the Stripe projection lock', () => {
  it('pauses a profile without rewriting an ambiguous legacy account grant', async () => {
    state.metadata = { cardforgeAccess: 'contributor', cardforgeCommercialPlan: 'designer',
      cardforgeAuthorityRoles: ['contributor'], cardforgeAccessExpiresAt: '2030-01-01' };
    state.profile = { clerk_user_id: 'user_one', status: 'active' };
    await updateOwnerPerson({ userId: 'user_one', account: { commercialPlan: '', contributor: true, owner: false, note: '' },
      contributor: { status: 'suspended' } });
    expect(state.updates).not.toHaveBeenCalled();
    expect(state.metadata.cardforgeAccessExpiresAt).toBe('2030-01-01');
    expect(state.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended' }));
  });

  it('revokes only Contributor authority and preserves independent grants and Owner access', async () => {
    state.metadata = { ...state.metadata, cardforgeAccess: 'contributor', cardforgeRole: 'owner',
      cardforgeAuthorityRoles: ['contributor', 'other'], cardforgeAccessExpiresAt: '2030-01-01',
      cardforgeOwnerNote: 'keep', cardforgeFounderBetaClaimedAt: '2026-01-01' };
    await updateOwnerPerson({ userId: 'user_one', action: 'revoke' });
    expect(state.metadata).toMatchObject({ cardforgeAccess: 'paid', cardforgeRole: 'owner',
      cardforgeAuthorityRoles: ['other'], cardforgeOwnerCommercialPlan: 'designer',
      cardforgeCommercialPlan: 'designer', cardforgeStripeSubscriptionId: 'sub_creator',
      cardforgeAccessExpiresAt: '2030-01-01', cardforgeOwnerNote: 'keep',
      cardforgeFounderBetaClaimedAt: '2026-01-01' });
  });

  it('removes an extra grant without canceling paid access', async () => {
    await updateOwnerPerson(input());

    expect(state.metadata).toMatchObject({
      cardforgeOwnerCommercialPlan: 'free',
      cardforgeCommercialPlan: 'creator',
      cardforgeAccess: 'paid',
    });
    expect(state.locked).toBe(false);
  });

  it('refuses an owner write during webhook projection', async () => {
    state.locked = true;

    await expect(updateOwnerPerson(input())).rejects.toMatchObject({
      status: 409,
      code: 'owner_operations_conflict',
    });
    expect(state.updates).not.toHaveBeenCalled();
    expect(state.locked).toBe(true);
  });

  it('releases its lock without reporting success after a Clerk failure', async () => {
    state.failWrite = true;

    await expect(updateOwnerPerson(input())).rejects.toThrow('Clerk unavailable');
    expect(state.locked).toBe(false);
    expect(state.metadata.cardforgeOwnerCommercialPlan).toBe('designer');
  });
});
