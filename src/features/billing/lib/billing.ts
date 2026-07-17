import type Stripe from 'stripe';

import { getConfiguredPublicAppUrl } from '@/infrastructure/http/publicUrl';

export type BillingEnvironment = Partial<Record<
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_CREATOR_PASS_PRICE_ID'
  | 'STRIPE_SUPPORT_MONTHLY_1_PRICE_ID'
  | 'STRIPE_SUPPORT_MONTHLY_5_PRICE_ID'
  | 'STRIPE_SUPPORT_MONTHLY_10_PRICE_ID'
  | 'STRIPE_SUPPORT_MONTHLY_20_PRICE_ID'
  | 'STRIPE_SUPPORT_CURRENCY'
  | 'STRIPE_SUPPORT_PORTAL_URL'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'NEXT_PUBLIC_APP_URL'
  | 'VERCEL_PROJECT_PRODUCTION_URL'
  | 'VERCEL_URL',
  string
>>;

export interface BillingConfigStatus {
  productAccessConfigured: boolean;
  supportOneTimeConfigured: boolean;
  supportMonthlyConfigured: boolean;
  supportConfigured: boolean;
  webhookConfigured: boolean;
  missingProductAccess: string[];
  missingSupport: string[];
}

export interface BuildProductAccessCheckoutSessionParamsInput {
  appUrl: string;
  email?: string | null;
  priceId: string;
  userId: string;
}

export type CreatorSupportOffering = 'support_one_time' | 'support_monthly';
export type SupportMonthlyAmountCents = 100 | 500 | 1000 | 2000;

export const SUPPORT_MONTHLY_AMOUNTS_CENTS: readonly SupportMonthlyAmountCents[] = [
  100,
  500,
  1000,
  2000,
];
export const SUPPORT_ONE_TIME_MINIMUM_CENTS = 100;
export const SUPPORT_ONE_TIME_MAXIMUM_CENTS = 100_000;
export const SUPPORT_ONE_TIME_PRESET_CENTS = 500;

export interface CreatorSupportOfferConfiguration {
  currency: string;
  monthlyPriceIds: Record<SupportMonthlyAmountCents, string>;
  oneTimeMaximumCents: typeof SUPPORT_ONE_TIME_MAXIMUM_CENTS;
  oneTimeMinimumCents: typeof SUPPORT_ONE_TIME_MINIMUM_CENTS;
  oneTimePresetCents: typeof SUPPORT_ONE_TIME_PRESET_CENTS;
  portalUrl: string;
}

export interface BuildCreatorSupportCheckoutSessionParamsInput {
  appUrl: string;
  amountCents: number;
  currency: string;
  email?: string | null;
  offering: CreatorSupportOffering;
  priceId?: string;
  userId?: string | null;
}

export interface BuildBillingPortalSessionParamsInput {
  appUrl: string;
  customerId: string;
}

export interface BuildStripePaidAccessMetadataInput {
  existingMetadata?: Record<string, unknown>;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
}

const readEnvironment = (env?: BillingEnvironment): BillingEnvironment => env ?? {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_CREATOR_PASS_PRICE_ID: process.env.STRIPE_CREATOR_PASS_PRICE_ID,
  STRIPE_SUPPORT_MONTHLY_1_PRICE_ID: process.env.STRIPE_SUPPORT_MONTHLY_1_PRICE_ID,
  STRIPE_SUPPORT_MONTHLY_5_PRICE_ID: process.env.STRIPE_SUPPORT_MONTHLY_5_PRICE_ID,
  STRIPE_SUPPORT_MONTHLY_10_PRICE_ID: process.env.STRIPE_SUPPORT_MONTHLY_10_PRICE_ID,
  STRIPE_SUPPORT_MONTHLY_20_PRICE_ID: process.env.STRIPE_SUPPORT_MONTHLY_20_PRICE_ID,
  STRIPE_SUPPORT_CURRENCY: process.env.STRIPE_SUPPORT_CURRENCY,
  STRIPE_SUPPORT_PORTAL_URL: process.env.STRIPE_SUPPORT_PORTAL_URL,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

export const getBillingConfigStatus = (env?: BillingEnvironment): BillingConfigStatus => {
  const source = readEnvironment(env);
  const appUrl = getConfiguredPublicAppUrl(source);
  const sharedValues: Array<[string, string | undefined]> = [
    ['STRIPE_SECRET_KEY', source.STRIPE_SECRET_KEY],
    ['NEXT_PUBLIC_APP_URL', appUrl ?? undefined],
  ];
  const missingProductAccess = [
    ['STRIPE_CREATOR_PASS_PRICE_ID', source.STRIPE_CREATOR_PASS_PRICE_ID] as [string, string | undefined],
    ...sharedValues,
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const supportValues: Array<[string, string | undefined]> = [
    ['STRIPE_SUPPORT_MONTHLY_1_PRICE_ID', source.STRIPE_SUPPORT_MONTHLY_1_PRICE_ID],
    ['STRIPE_SUPPORT_MONTHLY_5_PRICE_ID', source.STRIPE_SUPPORT_MONTHLY_5_PRICE_ID],
    ['STRIPE_SUPPORT_MONTHLY_10_PRICE_ID', source.STRIPE_SUPPORT_MONTHLY_10_PRICE_ID],
    ['STRIPE_SUPPORT_MONTHLY_20_PRICE_ID', source.STRIPE_SUPPORT_MONTHLY_20_PRICE_ID],
    ['STRIPE_SUPPORT_CURRENCY', source.STRIPE_SUPPORT_CURRENCY],
    ['STRIPE_SUPPORT_PORTAL_URL', source.STRIPE_SUPPORT_PORTAL_URL],
    ...sharedValues,
  ];
  const missingSupport = supportValues
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const supportOneTimeConfigured = Boolean(
    source.STRIPE_SECRET_KEY
      && normalizeCurrency(source.STRIPE_SUPPORT_CURRENCY)
      && appUrl,
  );
  const supportMonthlyConfigured = Boolean(
    source.STRIPE_SECRET_KEY
      && source.STRIPE_SUPPORT_MONTHLY_1_PRICE_ID
      && source.STRIPE_SUPPORT_MONTHLY_5_PRICE_ID
      && source.STRIPE_SUPPORT_MONTHLY_10_PRICE_ID
      && source.STRIPE_SUPPORT_MONTHLY_20_PRICE_ID
      && normalizeCurrency(source.STRIPE_SUPPORT_CURRENCY)
      && normalizeHttpsUrl(source.STRIPE_SUPPORT_PORTAL_URL)
      && appUrl,
  );

  return {
    productAccessConfigured: missingProductAccess.length === 0,
    supportOneTimeConfigured,
    supportMonthlyConfigured,
    supportConfigured: supportOneTimeConfigured && supportMonthlyConfigured,
    webhookConfigured: Boolean(source.STRIPE_WEBHOOK_SECRET),
    missingProductAccess,
    missingSupport,
  };
};

const normalizeCurrency = (value: string | undefined): string | null => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return /^[a-z]{3}$/.test(normalized) ? normalized : null;
};

const normalizeHttpsUrl = (value: string | undefined): string | null => {
  try {
    const parsed = new URL(value ?? '');
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

export const getCreatorSupportOfferConfiguration = (
  env?: BillingEnvironment,
): CreatorSupportOfferConfiguration | null => {
  const source = readEnvironment(env);
  const currency = normalizeCurrency(source.STRIPE_SUPPORT_CURRENCY);
  const portalUrl = normalizeHttpsUrl(source.STRIPE_SUPPORT_PORTAL_URL);
  if (
    !source.STRIPE_SECRET_KEY
    || !getConfiguredPublicAppUrl(source)
    || !source.STRIPE_SUPPORT_MONTHLY_1_PRICE_ID
    || !source.STRIPE_SUPPORT_MONTHLY_5_PRICE_ID
    || !source.STRIPE_SUPPORT_MONTHLY_10_PRICE_ID
    || !source.STRIPE_SUPPORT_MONTHLY_20_PRICE_ID
    || !currency
    || !portalUrl
  ) return null;

  return {
    currency,
    monthlyPriceIds: {
      100: source.STRIPE_SUPPORT_MONTHLY_1_PRICE_ID,
      500: source.STRIPE_SUPPORT_MONTHLY_5_PRICE_ID,
      1000: source.STRIPE_SUPPORT_MONTHLY_10_PRICE_ID,
      2000: source.STRIPE_SUPPORT_MONTHLY_20_PRICE_ID,
    },
    oneTimeMaximumCents: SUPPORT_ONE_TIME_MAXIMUM_CENTS,
    oneTimeMinimumCents: SUPPORT_ONE_TIME_MINIMUM_CENTS,
    oneTimePresetCents: SUPPORT_ONE_TIME_PRESET_CENTS,
    portalUrl,
  };
};

export const normalizeCreatorSupportOffering = (value: unknown): CreatorSupportOffering | null => (
  value === 'support_one_time' || value === 'support_monthly' ? value : null
);

export const normalizeSupportOneTimeAmountCents = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed)
    && parsed >= SUPPORT_ONE_TIME_MINIMUM_CENTS
    && parsed <= SUPPORT_ONE_TIME_MAXIMUM_CENTS
    ? parsed
    : null;
};

export const normalizeSupportMonthlyAmountCents = (value: unknown): SupportMonthlyAmountCents | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return SUPPORT_MONTHLY_AMOUNTS_CENTS.includes(parsed as SupportMonthlyAmountCents)
    ? parsed as SupportMonthlyAmountCents
    : null;
};

export const validateCreatorSupportPrice = ({
  offering,
  amountCents,
  configured,
  price,
}: {
  offering: CreatorSupportOffering;
  amountCents: number;
  configured: CreatorSupportOfferConfiguration;
  price: {
    active?: boolean;
    currency?: string;
    id?: string;
    recurring?: { interval?: string } | null;
    unit_amount?: number | null;
  };
}): boolean => {
  if (offering === 'support_one_time') {
    return price.active === true
      && price.currency?.toLowerCase() === configured.currency
      && price.unit_amount === amountCents
      && !price.recurring
      && normalizeSupportOneTimeAmountCents(amountCents) !== null;
  }
  const monthlyAmountCents = normalizeSupportMonthlyAmountCents(amountCents);
  return price.active === true
    && monthlyAmountCents !== null
    && price.id === configured.monthlyPriceIds[monthlyAmountCents]
    && price.currency?.toLowerCase() === configured.currency
    && price.unit_amount === monthlyAmountCents
    && price.recurring?.interval === 'month';
};

export const buildProductAccessCheckoutSessionParams = ({
  appUrl,
  email,
  priceId,
  userId,
}: BuildProductAccessCheckoutSessionParamsInput): Stripe.Checkout.SessionCreateParams => {
  const normalizedAppUrl = appUrl.replace(/\/+$/, '');
  const metadata = {
    clerkUserId: userId,
    billingPurpose: 'product_access',
    billingOffering: 'creator_pass',
  };

  return {
    mode: 'subscription',
    customer_email: email || undefined,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${normalizedAppUrl}/account?checkout=success`,
    cancel_url: `${normalizedAppUrl}/account?checkout=cancelled`,
    allow_promotion_codes: true,
    metadata: {
      ...metadata,
      storageModel: 'local-only',
    },
    subscription_data: {
      metadata,
    },
  };
};

export const buildCreatorSupportCheckoutSessionParams = ({
  appUrl,
  amountCents,
  currency,
  email,
  offering,
  priceId,
  userId,
}: BuildCreatorSupportCheckoutSessionParamsInput): Stripe.Checkout.SessionCreateParams => {
  const normalizedAppUrl = appUrl.replace(/\/+$/, '');
  const metadata = {
    billingPurpose: 'creator_support',
    billingOffering: offering,
    ...(offering === 'support_monthly' ? { supportTierAmountCents: String(amountCents) } : {}),
    ...(userId ? { clerkUserId: userId } : {}),
  };
  const common: Stripe.Checkout.SessionCreateParams = {
    mode: offering === 'support_one_time' ? 'payment' : 'subscription',
    customer_email: email || undefined,
    client_reference_id: userId || undefined,
    line_items: offering === 'support_one_time'
      ? [{
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: 'Support Cameron — one time',
              description: 'Voluntary one-time support for independent CardForge Studio development. No product access.',
            },
          },
          quantity: 1,
        }]
      : [{ price: priceId!, quantity: 1 }],
    success_url: `${normalizedAppUrl}/support?payment=success`,
    cancel_url: `${normalizedAppUrl}/support?payment=cancelled`,
    metadata,
    custom_text: {
      submit: {
        message: 'Voluntary support is separate from Creator Pass and does not provide CardForge product access.',
      },
    },
  };

  if (offering === 'support_one_time') {
    return {
      ...common,
      customer_creation: 'always',
      payment_intent_data: { metadata },
    };
  }

  return {
    ...common,
    subscription_data: { metadata },
  };
};

export const buildBillingPortalSessionParams = ({
  appUrl,
  customerId,
}: BuildBillingPortalSessionParamsInput): Stripe.BillingPortal.SessionCreateParams => {
  const normalizedAppUrl = appUrl.replace(/\/+$/, '');

  return {
    customer: customerId,
    return_url: `${normalizedAppUrl}/account`,
  };
};

export const getStripeCustomerIdFromMetadata = (
  metadata: Record<string, unknown> | undefined
): string | null => {
  const value = metadata?.cardforgeStripeCustomerId;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const shouldRevokeStripePaidAccessForSubscription = (
  existingMetadata: Record<string, unknown>,
  subscriptionId: string,
): boolean => {
  const storedSubscriptionId = existingMetadata.cardforgeStripeSubscriptionId;
  return typeof storedSubscriptionId !== 'string'
    || storedSubscriptionId.trim().length === 0
    || storedSubscriptionId === subscriptionId;
};

export const buildStripePaidAccessMetadata = ({
  existingMetadata = {},
  stripeCustomerId,
  stripeSubscriptionId,
  stripeCheckoutSessionId,
}: BuildStripePaidAccessMetadataInput): Record<string, unknown> => ({
  ...existingMetadata,
  cardforgeAccess: 'paid',
  cardforgeAccessExpiresAt: null,
  cardforgeStripeCustomerId: stripeCustomerId ?? existingMetadata.cardforgeStripeCustomerId ?? null,
  cardforgeStripeSubscriptionId: stripeSubscriptionId ?? existingMetadata.cardforgeStripeSubscriptionId ?? null,
  cardforgeStripeCheckoutSessionId: stripeCheckoutSessionId ?? existingMetadata.cardforgeStripeCheckoutSessionId ?? null,
  cardforgeStripeAccessUpdatedAt: new Date().toISOString(),
});

export const buildStripeRevokedAccessMetadata = (
  existingMetadata: Record<string, unknown> = {}
): Record<string, unknown> => {
  const nextMetadata = {
    ...existingMetadata,
    cardforgeAccess: existingMetadata.cardforgeAccess === 'paid' ? 'free' : existingMetadata.cardforgeAccess,
    cardforgeAccessExpiresAt: null,
    cardforgeStripeAccessUpdatedAt: new Date().toISOString(),
  };

  return nextMetadata;
};

export const shouldGrantAccessForStripeSubscriptionStatus = (status: string | null | undefined): boolean =>
  status === 'active' || status === 'trialing';

export const shouldRevokeAccessForStripeSubscriptionStatus = (status: string | null | undefined): boolean =>
  status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid';
