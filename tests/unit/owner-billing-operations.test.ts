import { describe, expect, it } from 'vitest';

import {
  buildOwnerBillingSnapshot,
  mapStripeCheckoutSessionSummary,
  mapStripeSubscriptionSummary,
} from '@/features/owner/lib/ownerBillingOperations';

describe('owner billing operations', () => {
  it('maps checkout sessions into a safe owner billing summary', () => {
    expect(mapStripeCheckoutSessionSummary({
      id: 'cs_test_123',
      customer: 'cus_123',
      customer_email: 'maker@example.test',
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
      amount_total: 899,
      currency: 'usd',
      created: 1_768_000_000,
      subscription: 'sub_123',
      metadata: { clerkUserId: 'user_123', product: 'cardforge-studio-export' },
    })).toEqual({
      id: 'cs_test_123',
      customerId: 'cus_123',
      customerEmail: 'maker@example.test',
      clerkUserId: 'user_123',
      mode: 'subscription',
      paymentStatus: 'paid',
      status: 'complete',
      amountTotalCents: 899,
      currency: 'usd',
      createdAt: '2026-01-09T23:06:40.000Z',
      subscriptionId: 'sub_123',
    });
  });

  it('maps subscriptions into a safe owner subscription summary', () => {
    expect(mapStripeSubscriptionSummary({
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      current_period_end: 1_768_100_000,
      cancel_at_period_end: false,
      metadata: { clerkUserId: 'user_123' },
      items: {
        data: [{
          price: {
            id: 'price_123',
            unit_amount: 899,
            currency: 'usd',
            recurring: { interval: 'month' },
          },
        }],
      },
    })).toEqual({
      id: 'sub_123',
      customerId: 'cus_123',
      clerkUserId: 'user_123',
      status: 'active',
      currentPeriodEnd: '2026-01-11T02:53:20.000Z',
      cancelAtPeriodEnd: false,
      priceId: 'price_123',
      amountCents: 899,
      currency: 'usd',
      interval: 'month',
    });
  });

  it('builds a billing snapshot with configuration gaps and safe recent activity', () => {
    const snapshot = buildOwnerBillingSnapshot({
      config: { checkoutConfigured: true, webhookConfigured: false, missing: [] },
      checkoutSessions: [{
        id: 'cs_test_123',
        customer: null,
        customer_email: null,
        mode: 'subscription',
        payment_status: 'unpaid',
        status: 'open',
        amount_total: null,
        currency: 'usd',
        created: 1_768_000_000,
        subscription: null,
        metadata: {},
      }],
      subscriptions: [],
    });

    expect(snapshot.status.webhookConfigured).toBe(false);
    expect(snapshot.recentCheckoutSessions).toHaveLength(1);
    expect(snapshot.recentSubscriptions).toEqual([]);
  });
});
