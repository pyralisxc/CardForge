import { describe, expect, it, vi } from 'vitest';

import {
  buildMissingBillingSubscriptionBaselines,
  establishBillingSubscriptionBaselines,
} from '@/features/billing/lib/billingReconciliation';

describe('billing reconciliation', () => {
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
