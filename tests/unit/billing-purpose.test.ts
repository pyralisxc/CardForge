import { describe, expect, it } from 'vitest';

import {
  canBillingPurposeUpdateProductEntitlement,
  classifyBillingPurpose,
  classifySubscriptionBillingPurpose,
  resolveCurrentProductEntitlement,
} from '@/features/billing/lib/billingPurpose';

const prices = {
  creatorPassPriceId: 'price_creator_pass',
  supportMonthlyPriceIds: {
    100: 'price_support_1',
    500: 'price_support_5',
    1000: 'price_support_10',
    2000: 'price_support_20',
  },
  supportCurrency: 'usd',
};

describe('billing purpose classification', () => {
  it('accepts product access only when purpose, offering, mode, and price all match', () => {
    expect(classifyBillingPurpose({
      metadata: { billingPurpose: 'product_access', billingOffering: 'creator_pass' },
      mode: 'subscription',
      priceIds: ['price_creator_pass'],
      prices,
    })).toEqual({
      accepted: true,
      purpose: 'product_access',
      offering: 'creator_pass',
      reason: null,
    });
  });

  it('accepts a bounded one-time amount and the four fixed monthly tiers', () => {
    expect(classifyBillingPurpose({
      metadata: { billingPurpose: 'creator_support', billingOffering: 'support_one_time' },
      mode: 'payment',
      priceIds: ['price_inline'],
      amountCents: 725,
      currency: 'usd',
      prices,
    }).accepted).toBe(true);

    for (const [amountCents, priceId] of [[100, 'price_support_1'], [500, 'price_support_5'], [1000, 'price_support_10'], [2000, 'price_support_20']] as const) {
      expect(classifyBillingPurpose({
        metadata: {
          billingPurpose: 'creator_support',
          billingOffering: 'support_monthly',
          supportTierAmountCents: String(amountCents),
        },
        mode: 'subscription',
        priceIds: [priceId],
        amountCents,
        currency: 'usd',
        prices,
      }).accepted).toBe(true);
    }
  });

  it('fails safely for missing purpose, wrong mode, or a mismatched price', () => {
    for (const input of [
      { metadata: {} as Record<string, string | null>, mode: 'subscription', priceIds: ['price_creator_pass'] },
      {
        metadata: { billingPurpose: 'creator_support', billingOffering: 'support_one_time' },
        mode: 'subscription',
        priceIds: ['price_inline'],
      },
      {
        metadata: { billingPurpose: 'creator_support', billingOffering: 'support_monthly' },
        mode: 'subscription',
        priceIds: ['price_creator_pass'],
      },
    ]) {
      const result = classifyBillingPurpose({ ...input, amountCents: 500, currency: 'usd', prices });
      expect(result.accepted).toBe(false);
      expect(result.purpose).toBe('unmatched');
    }
  });

  it('never lets creator support or unmatched events update product entitlement', () => {
    expect(canBillingPurposeUpdateProductEntitlement('product_access')).toBe(true);
    expect(canBillingPurposeUpdateProductEntitlement('creator_support')).toBe(false);
    expect(canBillingPurposeUpdateProductEntitlement('unmatched')).toBe(false);
  });

  it('classifies subscriptions from explicit metadata and a server-owned price', () => {
    expect(classifySubscriptionBillingPurpose({
      subscription: {
        metadata: {
          billingPurpose: 'creator_support',
          billingOffering: 'support_monthly',
          supportTierAmountCents: '500',
        },
        items: { data: [{ price: { id: 'price_support_5', unit_amount: 500, currency: 'usd' } }] },
      },
      prices,
    }).purpose).toBe('creator_support');
    expect(classifySubscriptionBillingPurpose({
      subscription: {
        metadata: {},
        items: { data: [{ price: { id: 'price_creator_pass' } }] },
      },
      prices,
    }).purpose).toBe('unmatched');
  });

  it('keeps access on a different active Creator Pass when an older subscription ends', () => {
    const ended = {
      id: 'sub_old',
      status: 'canceled',
      metadata: {
        clerkUserId: 'user_123',
        billingPurpose: 'product_access',
        billingOffering: 'creator_pass',
      },
      items: { data: [{ price: { id: 'price_creator_pass', unit_amount: 1000, currency: 'usd' } }] },
    };
    const active = {
      id: 'sub_new',
      status: 'active',
      metadata: {
        clerkUserId: 'user_123',
        billingPurpose: 'product_access',
        billingOffering: 'creator_pass',
      },
      items: { data: [{ price: { id: 'price_creator_pass', unit_amount: 1000, currency: 'usd' } }] },
    };

    expect(resolveCurrentProductEntitlement({
      current: ended,
      customerSubscriptions: [ended, active],
      prices,
    })).toEqual({ action: 'paid', subscription: active });
    expect(resolveCurrentProductEntitlement({
      current: ended,
      customerSubscriptions: [ended],
      prices,
    })).toEqual({ action: 'free', subscription: ended });
  });

  it('uses the retrieved current subscription status instead of an older event snapshot', () => {
    const current = {
      id: 'sub_123',
      status: 'canceled',
      metadata: {
        clerkUserId: 'user_123',
        billingPurpose: 'product_access',
        billingOffering: 'creator_pass',
      },
      items: { data: [{ price: { id: 'price_creator_pass', unit_amount: 1000, currency: 'usd' } }] },
    };

    expect(resolveCurrentProductEntitlement({
      current,
      customerSubscriptions: [current],
      prices,
    }).action).toBe('free');
  });
});
