import 'server-only';

import { createHash } from 'node:crypto';

import { unstable_cache } from 'next/cache';
import Stripe from 'stripe';

import { resolveWithTimeout } from '@/shared/asyncTimeout';

export type ProductAccessPricePlan = 'creator' | 'designer';

export interface ProductAccessPricePresentation {
  available: boolean;
  priceId: string | null;
  priceLabel: string;
  priceNote: string;
  currency: string | null;
  interval: string | null;
  intervalCount: number | null;
  provider: 'stripe';
}

export type ProductAccessPricePresentationMap = Record<
  ProductAccessPricePlan,
  ProductAccessPricePresentation
>;

type StripePriceProjection = Pick<
  Stripe.Price,
  'active' | 'currency' | 'id' | 'recurring' | 'unit_amount'
>;

const unavailablePrice = ({
  priceId,
  configured,
}: {
  priceId: string | null;
  configured: boolean;
}): ProductAccessPricePresentation => ({
  available: false,
  priceId,
  priceLabel: 'Unavailable',
  priceNote: configured
    ? 'Stripe price temporarily unavailable'
    : 'Stripe checkout not configured',
  currency: null,
  interval: null,
  intervalCount: null,
  provider: 'stripe',
});

const currencyDivisor = (currency: string): number => {
  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
    return 10 ** formatter.resolvedOptions().maximumFractionDigits;
  } catch {
    return 100;
  }
};

const formatAmount = (unitAmount: number, currency: string): string => {
  const amount = unitAmount / currencyDivisor(currency);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return amount.toFixed(2) + ' ' + currency.toUpperCase();
  }
};

const formatRecurringInterval = (
  interval: string,
  intervalCount: number,
): string => {
  if (intervalCount <= 1) {
    if (interval === 'day') return 'per day';
    if (interval === 'week') return 'per week';
    if (interval === 'month') return 'per month';
    if (interval === 'year') return 'per year';
    return 'per ' + interval;
  }
  const plural = interval.endsWith('s') ? interval : interval + 's';
  return 'every ' + intervalCount + ' ' + plural;
};

export const projectStripeProductAccessPrice = (
  price: StripePriceProjection | null | undefined,
): ProductAccessPricePresentation => {
  const priceId = price?.id ?? null;
  const recurring = price?.recurring;
  const interval = recurring?.interval ?? null;
  const intervalCount = recurring?.interval_count ?? 1;
  if (
    !price
    || price.active !== true
    || typeof price.unit_amount !== 'number'
    || !Number.isSafeInteger(price.unit_amount)
    || price.unit_amount < 0
    || typeof price.currency !== 'string'
    || !price.currency.trim()
    || !interval
    || !Number.isSafeInteger(intervalCount)
    || intervalCount < 1
  ) {
    return unavailablePrice({ priceId, configured: Boolean(priceId) });
  }

  return {
    available: true,
    priceId,
    priceLabel: formatAmount(price.unit_amount, price.currency),
    priceNote: formatRecurringInterval(interval, intervalCount),
    currency: price.currency.toLowerCase(),
    interval,
    intervalCount,
    provider: 'stripe',
  };
};

const createFallback = ({
  creatorPriceId,
  designerPriceId,
  stripeConfigured,
}: {
  creatorPriceId: string | null;
  designerPriceId: string | null;
  stripeConfigured: boolean;
}): ProductAccessPricePresentationMap => ({
  creator: unavailablePrice({
    priceId: creatorPriceId,
    configured: stripeConfigured && Boolean(creatorPriceId),
  }),
  designer: unavailablePrice({
    priceId: designerPriceId,
    configured: stripeConfigured && Boolean(designerPriceId),
  }),
});

const loadStripeProductAccessPrices = async ({
  stripeSecretKey,
  creatorPriceId,
  designerPriceId,
}: {
  stripeSecretKey: string;
  creatorPriceId: string | null;
  designerPriceId: string | null;
}): Promise<ProductAccessPricePresentationMap> => {
  const stripe = new Stripe(stripeSecretKey, {
    maxNetworkRetries: 0,
    timeout: 3500,
  });

  const load = async (
    priceId: string | null,
  ): Promise<ProductAccessPricePresentation> => {
    if (!priceId) return unavailablePrice({ priceId: null, configured: false });
    try {
      return projectStripeProductAccessPrice(await stripe.prices.retrieve(priceId));
    } catch (error) {
      console.error('Unable to read configured Stripe product-access price:', priceId, error);
      return unavailablePrice({ priceId, configured: true });
    }
  };

  const [creator, designer] = await Promise.all([
    load(creatorPriceId),
    load(designerPriceId),
  ]);
  return { creator, designer };
};

export const getCurrentProductAccessPricePresentation = async (): Promise<ProductAccessPricePresentationMap> => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  const creatorPriceId = process.env.STRIPE_CREATOR_PASS_PRICE_ID?.trim() || null;
  const designerPriceId = process.env.STRIPE_DESIGNER_PASS_PRICE_ID?.trim() || null;
  const fallback = createFallback({
    creatorPriceId,
    designerPriceId,
    stripeConfigured: Boolean(stripeSecretKey),
  });
  if (!stripeSecretKey) return fallback;

  const deploymentEnvironment = process.env.VERCEL_ENV ?? 'development';
  const deploymentVersion = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local';
  const stripeAccountFingerprint = createHash('sha256')
    .update(stripeSecretKey)
    .digest('hex')
    .slice(0, 12);

  return unstable_cache(
    () => resolveWithTimeout(
      loadStripeProductAccessPrices({
        stripeSecretKey,
        creatorPriceId,
        designerPriceId,
      }),
      { fallback, timeoutMs: 4000 },
    ),
    [
      'cardforge-product-access-price-presentation-v1',
      deploymentEnvironment,
      deploymentVersion,
      creatorPriceId ?? 'missing-creator',
      designerPriceId ?? 'missing-designer',
      stripeAccountFingerprint,
    ],
    { revalidate: 300 },
  )();
};
