import { describe, expect, it } from 'vitest';

import {
  buildOwnerAccountMetadataPatch,
  mapOwnerAccountSummary,
  normalizeOwnerAccountRoleInput,
  resolveAccountEntitlement,
} from '@/features/account/server';

describe('account administration', () => {
  it('normalizes owner account role changes to supported private metadata values', () => {
    expect(normalizeOwnerAccountRoleInput({
      commercialPlan: 'designer',
      contributor: true,
      owner: true,
      note: '  trusted collaborator ',
    })).toEqual({
      ok: true,
      value: {
        commercialPlan: 'designer',
        contributor: true,
        owner: true,
        note: 'trusted collaborator',
      },
    });

    expect(normalizeOwnerAccountRoleInput({ commercialPlan: 'enterprise' })).toEqual({
      ok: false,
      message: 'Choose a supported commercial plan.',
    });
  });

  it('builds a private metadata patch without removing Stripe identifiers', () => {
    expect(buildOwnerAccountMetadataPatch({
      existingMetadata: {
        cardforgeStripeCustomerId: 'cus_123',
        cardforgeStripeSubscriptionId: 'sub_123',
        cardforgeAccessExpiresAt: '2026-08-22T00:00:00.000Z',
        cardforgeFounderBetaClaimedAt: '2026-08-11T00:00:00.000Z',
      },
      input: { commercialPlan: 'designer', contributor: true, owner: true, note: 'Lead tester' },
    })).toMatchObject({
      cardforgeAccess: 'contributor',
      cardforgeCommercialPlan: 'designer',
      cardforgeAuthorityRoles: ['contributor'],
      cardforgeRole: 'owner',
      cardforgeOwnerNote: 'Lead tester',
      cardforgeStripeCustomerId: 'cus_123',
      cardforgeStripeSubscriptionId: 'sub_123',
    });
    const patch = buildOwnerAccountMetadataPatch({
      existingMetadata: {
        cardforgeAccessExpiresAt: '2026-08-22T00:00:00.000Z',
        cardforgeFounderBetaClaimedAt: '2026-08-11T00:00:00.000Z',
      },
      input: { commercialPlan: 'free', contributor: true, owner: false, note: '' },
    });
    expect(patch.cardforgeAccessExpiresAt).toBeNull();
    expect(patch.cardforgeFounderBetaClaimedAt).toBeNull();
  });

  it('clears owner role with an empty private metadata value Clerk will persist', () => {
    expect(buildOwnerAccountMetadataPatch({
      existingMetadata: { cardforgeRole: 'owner' },
      input: { commercialPlan: 'free', contributor: false, owner: false, note: '' },
    })).toMatchObject({
      cardforgeAccess: 'free',
      cardforgeRole: '',
    });
  });

  it('maps Clerk users into safe owner account summaries', () => {
    expect(mapOwnerAccountSummary({
      id: 'user_123',
      firstName: 'Ada',
      lastName: 'Lovelace',
      createdAt: 1_768_000_000_000,
      lastSignInAt: null,
      emailAddresses: [{ emailAddress: 'ada@example.test' }],
      privateMetadata: {
        cardforgeAccess: 'paid',
        cardforgeRole: 'owner',
        cardforgeStripeCustomerId: 'cus_123',
      },
      publicMetadata: { ignored: true },
    })).toEqual({
      id: 'user_123',
      email: 'ada@example.test',
      name: 'Ada Lovelace',
      access: 'paid',
      commercialPlan: 'creator',
      ownerCommercialPlan: null,
      contributorAuthority: false,
      isOwner: true,
      createdAt: '2026-01-09T23:06:40.000Z',
      lastSignInAt: null,
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: null,
      note: '',
    });
  });

  it('removes only the extra grant while preserving the last verified Stripe plan', () => {
    expect(buildOwnerAccountMetadataPatch({
      existingMetadata: { cardforgeStripeSubscriptionId: 'sub_creator', cardforgePaidPlan: 'creator', cardforgeOwnerCommercialPlan: 'designer' },
      input: { commercialPlan: 'free', contributor: false, owner: false, note: '' },
    })).toMatchObject({ cardforgeAccess: 'paid', cardforgeCommercialPlan: 'creator', cardforgeOwnerCommercialPlan: 'free' });
  });

  it('clears expired temporary access when Clerk merges a new permanent grant', () => {
    const existingMetadata = {
      cardforgeAccess: 'paid',
      cardforgeAccessExpiresAt: '2025-01-01T00:00:00Z',
      cardforgeFounderBetaClaimedAt: '2024-12-01T00:00:00Z',
    };
    const patch = buildOwnerAccountMetadataPatch({ existingMetadata,
      input: { commercialPlan: 'designer', contributor: false, owner: false, note: '' },
    });
    const merged = { ...existingMetadata, ...patch };
    const entitlement = resolveAccountEntitlement({ authConfigured: true, isSignedIn: true, privateMetadata: merged });
    expect(merged.cardforgeAccessExpiresAt).toBeNull();
    expect(merged.cardforgeFounderBetaClaimedAt).toBeNull();
    expect(entitlement).toMatchObject({ accessMode: 'paid', commercialPlan: 'designer', accessExpiresAt: null });
  });
});
