import type Stripe from 'stripe';

import { getConfiguredPublicAppUrl } from '@/lib/siteUrl';

type BillingEnvironment = Partial<Record<
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_PRICE_ID'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'NEXT_PUBLIC_APP_URL'
  | 'VERCEL_PROJECT_PRODUCTION_URL'
  | 'VERCEL_URL',
  string
>>;

export interface BillingConfigStatus {
  checkoutConfigured: boolean;
  webhookConfigured: boolean;
  missing: string[];
}

export interface BuildCheckoutSessionParamsInput {
  appUrl: string;
  email?: string | null;
  priceId: string;
  userId: string;
}

const readEnvironment = (env?: BillingEnvironment): BillingEnvironment => env ?? {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

export const getBillingConfigStatus = (env?: BillingEnvironment): BillingConfigStatus => {
  const source = readEnvironment(env);
  const appUrl = getConfiguredPublicAppUrl(source);
  const requiredValues: Array<[string, string | undefined]> = [
    ['STRIPE_SECRET_KEY', source.STRIPE_SECRET_KEY],
    ['STRIPE_PRICE_ID', source.STRIPE_PRICE_ID],
    ['NEXT_PUBLIC_APP_URL', appUrl ?? undefined],
  ];
  const missing = requiredValues
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    checkoutConfigured: missing.length === 0,
    webhookConfigured: Boolean(source.STRIPE_WEBHOOK_SECRET),
    missing,
  };
};

export const buildCheckoutSessionParams = ({
  appUrl,
  email,
  priceId,
  userId,
}: BuildCheckoutSessionParamsInput): Stripe.Checkout.SessionCreateParams => {
  const normalizedAppUrl = appUrl.replace(/\/+$/, '');
  const metadata = {
    clerkUserId: userId,
    product: 'cardforge-studio-export',
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
