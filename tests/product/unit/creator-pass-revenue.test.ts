import { describe, expect, it } from 'vitest';

import { summarizeCreatorPassSubscriptions } from '@/features/billing/server';

const creatorPassSubscription = ({
  id,
  status = 'active',
  priceId = 'price_creator_pass',
  amountCents = 1200,
  interval = 'month',
  intervalCount = 1,
  purpose = 'product_access',
  offering = 'creator_pass',
}: {
  id: string;
  status?: string;
  priceId?: string;
  amountCents?: number;
  interval?: 'month' | 'year';
  intervalCount?: number;
  purpose?: string;
  offering?: string;
}) => ({
  id,
  status,
  metadata: { billingPurpose: purpose, billingOffering: offering },
  items: {
    data: [{
      quantity: 1,
      price: {
        id: priceId,
        unit_amount: amountCents,
        currency: 'usd',
        recurring: { interval, interval_count: intervalCount },
      },
    }],
  },
});

describe('Creator Pass public revenue summary', () => {
  it('counts only active, configured Creator Pass subscriptions', () => {
    const summary = summarizeCreatorPassSubscriptions({
      creatorPassPriceId: 'price_creator_pass',
      subscriptions: [
        creatorPassSubscription({ id: 'active' }),
        creatorPassSubscription({ id: 'trial', status: 'trialing' }),
        creatorPassSubscription({ id: 'past-due', status: 'past_due' }),
        creatorPassSubscription({ id: 'support', purpose: 'creator_support', offering: 'support_monthly' }),
        creatorPassSubscription({ id: 'wrong-price', priceId: 'price_other' }),
      ],
    });

    expect(summary).toEqual({
      activeSubscriberCount: 1,
      grossMonthlyRevenueCents: 1200,
      currency: 'usd',
    });
  });

  it('normalizes an active annual Creator Pass price to monthly revenue', () => {
    const summary = summarizeCreatorPassSubscriptions({
      creatorPassPriceId: 'price_creator_pass',
      subscriptions: [creatorPassSubscription({
        id: 'annual',
        amountCents: 12_000,
        interval: 'year',
      })],
    });

    expect(summary.grossMonthlyRevenueCents).toBe(1000);
  });
});
