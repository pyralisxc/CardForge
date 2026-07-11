import { describe, expect, it } from 'vitest';

import {
  buildOwnerAccountMetadataPatch,
  mapOwnerAccountSummary,
  normalizeOwnerAccountRoleInput,
} from '@/lib/ownerAccountOperations';

describe('owner account operations', () => {
  it('normalizes owner account role changes to supported private metadata values', () => {
    expect(normalizeOwnerAccountRoleInput({
      access: 'dev',
      owner: true,
      note: '  trusted collaborator ',
    })).toEqual({
      ok: true,
      value: {
        access: 'dev',
        owner: true,
        note: 'trusted collaborator',
      },
    });

    expect(normalizeOwnerAccountRoleInput({ access: 'admin' })).toEqual({
      ok: false,
      message: 'Choose a supported access level.',
    });
  });

  it('builds a private metadata patch without removing Stripe identifiers', () => {
    expect(buildOwnerAccountMetadataPatch({
      existingMetadata: {
        cardforgeStripeCustomerId: 'cus_123',
        cardforgeStripeSubscriptionId: 'sub_123',
      },
      input: { access: 'dev', owner: true, note: 'Lead tester' },
    })).toMatchObject({
      cardforgeAccess: 'dev',
      cardforgeRole: 'owner',
      cardforgeOwnerNote: 'Lead tester',
      cardforgeStripeCustomerId: 'cus_123',
      cardforgeStripeSubscriptionId: 'sub_123',
    });
  });

  it('clears owner role with an empty private metadata value Clerk will persist', () => {
    expect(buildOwnerAccountMetadataPatch({
      existingMetadata: { cardforgeRole: 'owner' },
      input: { access: 'free', owner: false, note: '' },
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
      isOwner: true,
      createdAt: '2026-01-09T23:06:40.000Z',
      lastSignInAt: null,
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: null,
      note: '',
    });
  });
});
