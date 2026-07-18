import { describe, expect, it } from 'vitest';

import {
  BILLING_HISTORY_RETENTION_DAYS,
  DEFAULT_BILLING_HISTORY_LIMIT,
  buildOwnerBillingSnapshot,
  getEffectiveBillingHistoryStart,
  mapStripeCheckoutSessionSummary,
  mapStripeSubscriptionSummary,
  normalizeBillingHistoryLimit,
} from '@/features/billing/model/ownerBilling';

describe('owner billing operations', () => {
  it('normalizes checkout-history limits into the supported range', () => {
    expect(DEFAULT_BILLING_HISTORY_LIMIT).toBe(500);
    expect(normalizeBillingHistoryLimit(undefined)).toBe(500);
    expect(normalizeBillingHistoryLimit('125')).toBe(125);
    expect(normalizeBillingHistoryLimit(0)).toBe(1);
    expect(normalizeBillingHistoryLimit(900)).toBe(500);
    expect(normalizeBillingHistoryLimit(4.9)).toBe(4);
  });

  it('uses the later of the rolling retention window and clear cutoff', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    expect(BILLING_HISTORY_RETENTION_DAYS).toBe(30);
    expect(getEffectiveBillingHistoryStart({ now, clearedBefore: null }))
      .toBe('2026-06-15T12:00:00.000Z');
    expect(getEffectiveBillingHistoryStart({
      now,
      clearedBefore: '2026-07-14T12:00:00.000Z',
    })).toBe('2026-07-14T12:00:00.000Z');
    expect(getEffectiveBillingHistoryStart({
      now,
      clearedBefore: 'not-a-date',
    })).toBe('2026-06-15T12:00:00.000Z');
  });

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
      metadata: {
        clerkUserId: 'user_123',
        billingPurpose: 'product_access',
        billingOffering: 'creator_pass',
      },
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
      billingPurpose: 'product_access',
      billingOffering: 'creator_pass',
    });
  });

  it('distinguishes connected, stale, and absent Clerk mappings', () => {
    const baseSubscription = {
      customer: { id: 'cus_123', email: 'maker@example.test' },
      status: 'active',
      items: { data: [] },
    };
    expect(mapStripeSubscriptionSummary({
      ...baseSubscription,
      id: 'sub_connected',
      metadata: { clerkUserId: 'user_connected' },
    }, new Set(['user_connected'])).mappingStatus).toBe('connected');
    expect(mapStripeSubscriptionSummary({
      ...baseSubscription,
      id: 'sub_stale',
      metadata: { clerkUserId: 'user_stale' },
    }, new Set()).mappingStatus).toBe('stale');
    expect(mapStripeSubscriptionSummary({
      ...baseSubscription,
      id: 'sub_missing',
      metadata: {},
    }, new Set()).mappingStatus).toBe('missing');
  });

  it('maps subscriptions into a safe owner subscription summary', () => {
    expect(mapStripeSubscriptionSummary({
      id: 'sub_123',
      customer: { id: 'cus_123', email: 'maker@example.test' },
      status: 'active',
      cancel_at_period_end: false,
      metadata: {
        clerkUserId: 'user_123',
        billingPurpose: 'product_access',
        billingOffering: 'creator_pass',
      },
      items: {
        data: [{
          current_period_end: 1_768_100_000,
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
      customerEmail: 'maker@example.test',
      clerkUserId: 'user_123',
      mappingStatus: 'unverified',
      status: 'active',
      currentPeriodEnd: '2026-01-11T02:53:20.000Z',
      cancelAtPeriodEnd: false,
      priceId: 'price_123',
      amountCents: 899,
      currency: 'usd',
      interval: 'month',
      billingPurpose: 'product_access',
      billingOffering: 'creator_pass',
    });
  });

  it('builds a billing snapshot with configuration gaps and safe recent activity', () => {
    const snapshot = buildOwnerBillingSnapshot({
      config: {
        productAccessConfigured: true,
        supportOneTimeConfigured: false,
        supportMonthlyConfigured: false,
        supportConfigured: false,
        webhookConfigured: false,
        missingProductAccess: [],
        missingSupport: [],
      },
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
    expect(snapshot.recentRefunds).toEqual([]);
    expect(snapshot.historySettings).toMatchObject({
      limit: 500,
      retentionDays: 30,
      clearedBefore: null,
    });
  });

  it('reports Creator Pass and supporter revenue separately', () => {
    const snapshot = buildOwnerBillingSnapshot({
      checkoutSessions: [{
        id: 'cs_support_once',
        amount_total: 500,
        currency: 'usd',
        payment_status: 'paid',
        metadata: {
          billingPurpose: 'creator_support',
          billingOffering: 'support_one_time',
        },
      }],
      subscriptions: [
        {
          id: 'sub_product',
          status: 'active',
          metadata: { billingPurpose: 'product_access', billingOffering: 'creator_pass' },
          items: { data: [{ price: { unit_amount: 1200, currency: 'usd', recurring: { interval: 'month' } } }] },
        },
        {
          id: 'sub_support',
          status: 'active',
          metadata: { billingPurpose: 'creator_support', billingOffering: 'support_monthly' },
          items: { data: [{ price: { unit_amount: 700, currency: 'usd', recurring: { interval: 'month' } } }] },
        },
      ],
      refunds: [{ id: 're_1', amount: 500, currency: 'usd', status: 'succeeded' }],
    });

    expect(snapshot.metrics).toMatchObject({
      creatorPassMrrCents: 1200,
      supporterRecurringRevenueCents: 700,
      oneTimeSupportCents: 500,
      refundCount: 1,
      refundTotalCents: 500,
      activeCreatorPassSubscriptions: 1,
      activeSupportSubscriptions: 1,
    });
  });
});
