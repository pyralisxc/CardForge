import { createHash } from 'node:crypto';

import { unstable_cache } from 'next/cache';
import Stripe from 'stripe';

import { resolveWithTimeout } from '@/shared/asyncTimeout';

import { classifySubscriptionBillingPurpose } from './billingPurpose';

export interface CreatorPassSubscriptionInput {
  id: string;
  status?: string | null;
  metadata?: Record<string, string | null> | null;
  items?: {
    data?: Array<{
      quantity?: number | null;
      price?: {
        id?: string;
        unit_amount?: number | null;
        currency?: string | null;
        recurring?: {
          interval?: string | null;
          interval_count?: number | null;
        } | null;
      } | null;
    }>;
  };
}

export interface CreatorPassRevenueSummary {
  activeSubscriberCount: number;
  grossMonthlyRevenueCents: number;
  currency: string;
}

export interface CreatorPassRevenueSnapshot extends CreatorPassRevenueSummary {
  configured: boolean;
  available: boolean;
}

const toMonthlyAmountCents = ({
  amountCents,
  interval,
  intervalCount,
  quantity,
}: {
  amountCents: number;
  interval: string;
  intervalCount: number;
  quantity: number;
}): number | null => {
  const divisor = interval === 'month'
    ? intervalCount
    : interval === 'year'
      ? intervalCount * 12
      : 0;
  if (divisor <= 0) return null;
  return Math.round((amountCents * quantity) / divisor);
};

export const summarizeCreatorPassSubscriptions = ({
  subscriptions,
  creatorPassPriceId,
}: {
  subscriptions: CreatorPassSubscriptionInput[];
  creatorPassPriceId: string;
}): CreatorPassRevenueSummary => {
  let grossMonthlyRevenueCents = 0;
  let activeSubscriberCount = 0;
  let currency = 'usd';

  for (const subscription of subscriptions) {
    if (subscription.status !== 'active') continue;
    const classification = classifySubscriptionBillingPurpose({
      subscription,
      prices: { creatorPassPriceId },
    });
    if (classification.purpose !== 'product_access') continue;

    const item = subscription.items?.data?.find((candidate) => candidate.price?.id === creatorPassPriceId);
    const amountCents = item?.price?.unit_amount;
    const interval = item?.price?.recurring?.interval;
    if (typeof amountCents !== 'number' || !Number.isFinite(amountCents) || !interval) continue;
    const monthlyAmountCents = toMonthlyAmountCents({
      amountCents,
      interval,
      intervalCount: Math.max(1, Math.round(item.price?.recurring?.interval_count ?? 1)),
      quantity: Math.max(1, Math.round(item.quantity ?? 1)),
    });
    if (monthlyAmountCents === null) continue;

    activeSubscriberCount += 1;
    grossMonthlyRevenueCents += monthlyAmountCents;
    currency = item.price?.currency?.toLowerCase() || currency;
  }

  return { activeSubscriberCount, grossMonthlyRevenueCents, currency };
};

const unavailableSnapshot = (configured: boolean): CreatorPassRevenueSnapshot => ({
  configured,
  available: false,
  activeSubscriberCount: 0,
  grossMonthlyRevenueCents: 0,
  currency: 'usd',
});

const loadCurrentCreatorPassRevenue = async ({
  stripeSecretKey,
  creatorPassPriceId,
}: {
  stripeSecretKey: string;
  creatorPassPriceId: string;
}): Promise<CreatorPassRevenueSnapshot> => {
  const stripe = new Stripe(stripeSecretKey, {
    maxNetworkRetries: 0,
    timeout: 3500,
  });
  const subscriptions: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.subscriptions.list({
      status: 'active',
      price: creatorPassPriceId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    subscriptions.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) break;
  }

  return {
    configured: true,
    available: true,
    ...summarizeCreatorPassSubscriptions({ subscriptions, creatorPassPriceId }),
  };
};

export const getCurrentCreatorPassRevenue = async (): Promise<CreatorPassRevenueSnapshot> => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const creatorPassPriceId = process.env.STRIPE_CREATOR_PASS_PRICE_ID?.trim();
  if (!stripeSecretKey || !creatorPassPriceId) return unavailableSnapshot(false);

  const deploymentEnvironment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown';
  const deploymentVersion = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local';
  const stripeAccountFingerprint = createHash('sha256')
    .update(stripeSecretKey)
    .digest('hex')
    .slice(0, 12);
  const fallback = unavailableSnapshot(true);

  return unstable_cache(
    () => resolveWithTimeout(
      loadCurrentCreatorPassRevenue({ stripeSecretKey, creatorPassPriceId }),
      { fallback, timeoutMs: 4000 },
    ),
    [
      'cardforge-public-creator-pass-revenue-v2',
      deploymentEnvironment,
      deploymentVersion,
      creatorPassPriceId,
      stripeAccountFingerprint,
    ],
    { revalidate: 60 },
  )();
};
