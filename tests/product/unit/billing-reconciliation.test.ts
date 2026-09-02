import { describe, expect, it, vi } from 'vitest';

import {
  buildMissingBillingSubscriptionBaselines,
  establishBillingSubscriptionBaselines,
  findExactClerkUserByEmail,
  findExistingClerkUserIds,
  getStripeCustomerEmail,
  isClerkUserNotFoundError,
  persistBillingSubscriptionClerkMapping,
  repairStripeSubscriptionClerkMapping,
} from '@/features/billing/lib/billingReconciliation';

describe('billing reconciliation', () => {
  it('matches exactly one production Clerk user by Stripe email', async () => {
    const getUserList = vi.fn().mockResolvedValue({
      data: [{ id: 'user_prod' }],
      totalCount: 1,
    });

    await expect(findExactClerkUserByEmail({
      clerk: { users: { getUserList } },
      email: ' Maker@Example.com ',
    })).resolves.toEqual({ kind: 'matched', user: { id: 'user_prod' } });
    expect(getUserList).toHaveBeenCalledWith({
      emailAddress: ['maker@example.com'],
      limit: 2,
    });
  });

  it('does not guess when Clerk has no or multiple matching users', async () => {
    await expect(findExactClerkUserByEmail({
      clerk: { users: { getUserList: vi.fn().mockResolvedValue({ data: [], totalCount: 0 }) } },
      email: 'missing@example.com',
    })).resolves.toEqual({ kind: 'missing' });

    await expect(findExactClerkUserByEmail({
      clerk: {
        users: {
          getUserList: vi.fn().mockResolvedValue({
            data: [{ id: 'user_one' }, { id: 'user_two' }],
            totalCount: 2,
          }),
        },
      },
      email: 'shared@example.com',
    })).resolves.toEqual({ kind: 'ambiguous' });
  });

  it('verifies stored Clerk mappings in bounded batches', async () => {
    const getUserList = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: 'user_1' }], totalCount: 1 })
      .mockResolvedValueOnce({ data: [{ id: 'user_101' }], totalCount: 1 });
    const userIds = Array.from({ length: 101 }, (_, index) => `user_${index + 1}`);

    await expect(findExistingClerkUserIds({
      clerk: { users: { getUserList } },
      userIds,
    })).resolves.toEqual(new Set(['user_1', 'user_101']));
    expect(getUserList).toHaveBeenNthCalledWith(1, { userId: userIds.slice(0, 100), limit: 100 });
    expect(getUserList).toHaveBeenNthCalledWith(2, { userId: ['user_101'], limit: 100 });
  });

  it('propagates Clerk provider errors during email matching', async () => {
    const providerError = new Error('Clerk unavailable');
    await expect(findExactClerkUserByEmail({
      clerk: { users: { getUserList: vi.fn().mockRejectedValue(providerError) } },
      email: 'maker@example.com',
    })).rejects.toBe(providerError);
  });

  it('preserves Stripe metadata while replacing only the Clerk mapping', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'sub_123' });

    await repairStripeSubscriptionClerkMapping({
      stripe: { subscriptions: { update } },
      subscription: {
        id: 'sub_123',
        metadata: { existing: 'keep', clerkUserId: 'user_old' },
      },
      clerkUserId: 'user_prod',
    });

    expect(update).toHaveBeenCalledWith('sub_123', {
      metadata: { existing: 'keep', clerkUserId: 'user_prod' },
    });
  });

  it('keeps the Supabase subscription baseline aligned to the repaired user', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

    await persistBillingSubscriptionClerkMapping({
      client: { from },
      subscriptionId: 'sub_123',
      clerkUserId: 'user_prod',
      updatedAt: new Date('2026-07-15T12:00:00.000Z'),
    });

    expect(from).toHaveBeenCalledWith('cardforge_billing_subscriptions');
    expect(update).toHaveBeenCalledWith({
      clerk_user_id: 'user_prod',
      updated_at: '2026-07-15T12:00:00.000Z',
    });
    expect(eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123');
  });

  it('resolves expanded or retrievable Stripe customer email addresses', async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: 'cus_123', email: 'maker@example.com' });
    await expect(getStripeCustomerEmail({
      customer: { id: 'cus_expanded', email: 'expanded@example.com' },
      retrieve,
    })).resolves.toBe('expanded@example.com');
    expect(retrieve).not.toHaveBeenCalled();

    await expect(getStripeCustomerEmail({ customer: 'cus_123', retrieve }))
      .resolves.toBe('maker@example.com');
    expect(retrieve).toHaveBeenCalledWith('cus_123');
  });

  it('recognizes only Clerk user lookup 404 errors as missing users', () => {
    expect(isClerkUserNotFoundError({
      clerkError: true,
      code: 'api_response_error',
      status: 404,
    })).toBe(true);
    expect(isClerkUserNotFoundError({ status: 404 })).toBe(false);
    expect(isClerkUserNotFoundError({ clerkError: true, status: 500 })).toBe(false);
    expect(isClerkUserNotFoundError(null)).toBe(false);
  });

  it('builds a current ordering baseline for a missing Stripe subscription', () => {
    const reconciledAt = new Date('2026-07-15T22:00:00.000Z');

    expect(buildMissingBillingSubscriptionBaselines({
      subscriptions: [{
        id: 'sub_live_123',
        customer: 'cus_live_123',
        metadata: { clerkUserId: 'user_123' },
      }],
      existingSubscriptionIds: new Set(),
      reconciledAt,
    })).toEqual([{
      stripe_subscription_id: 'sub_live_123',
      stripe_customer_id: 'cus_live_123',
      clerk_user_id: 'user_123',
      last_event_created_at: reconciledAt.toISOString(),
      last_event_id: 'reconciliation:sub_live_123:1784152800000',
      updated_at: reconciledAt.toISOString(),
    }]);
  });

  it('reads expanded Stripe customer IDs without retaining customer data', () => {
    const [baseline] = buildMissingBillingSubscriptionBaselines({
      subscriptions: [{
        id: 'sub_live_123',
        customer: { id: 'cus_expanded_123' },
        metadata: null,
      }],
      existingSubscriptionIds: new Set(),
      reconciledAt: new Date('2026-07-15T22:00:00.000Z'),
    });

    expect(baseline).toMatchObject({
      stripe_customer_id: 'cus_expanded_123',
      clerk_user_id: null,
    });
  });

  it('does not overwrite a webhook-owned subscription row', () => {
    expect(buildMissingBillingSubscriptionBaselines({
      subscriptions: [{ id: 'sub_live_123', customer: null, metadata: {} }],
      existingSubscriptionIds: new Set(['sub_live_123']),
      reconciledAt: new Date('2026-07-15T22:00:00.000Z'),
    })).toEqual([]);
  });

  it('inserts baselines with conflict-ignore semantics', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const rows = buildMissingBillingSubscriptionBaselines({
      subscriptions: [{ id: 'sub_live_123', customer: null, metadata: {} }],
      existingSubscriptionIds: new Set(),
      reconciledAt: new Date('2026-07-15T22:00:00.000Z'),
    });

    await establishBillingSubscriptionBaselines({ client: { from }, rows });

    expect(from).toHaveBeenCalledWith('cardforge_billing_subscriptions');
    expect(upsert).toHaveBeenCalledWith(rows, {
      onConflict: 'stripe_subscription_id',
      ignoreDuplicates: true,
    });
  });
});
