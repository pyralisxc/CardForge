import { describe, expect, it } from 'vitest';

import {
  buildCheckoutSessionParams,
  getBillingConfigStatus,
} from '@/lib/billing';

describe('billing', () => {
  it('reports Stripe checkout as configured only when secret key, price, and app URL exist', () => {
    expect(getBillingConfigStatus({
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PRICE_ID: 'price_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      NEXT_PUBLIC_APP_URL: 'https://cardforge.example',
    })).toEqual({
      checkoutConfigured: true,
      webhookConfigured: true,
      missing: [],
    });

    expect(getBillingConfigStatus({
      STRIPE_SECRET_KEY: 'sk_test_123',
    })).toEqual({
      checkoutConfigured: false,
      webhookConfigured: false,
      missing: ['STRIPE_PRICE_ID', 'NEXT_PUBLIC_APP_URL'],
    });

    expect(getBillingConfigStatus({
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PRICE_ID: 'price_123',
      NEXT_PUBLIC_APP_URL: 'https://mpmmhjjhdxjedbmuctiv.supabase.co',
      VERCEL_PROJECT_PRODUCTION_URL: 'card-forge-snowy.vercel.app',
    })).toEqual({
      checkoutConfigured: true,
      webhookConfigured: false,
      missing: [],
    });
  });

  it('builds a subscription Checkout session that returns to the local-first app', () => {
    expect(buildCheckoutSessionParams({
      appUrl: 'https://cardforge.example/',
      priceId: 'price_123',
      userId: 'user_123',
      email: 'maker@example.com',
    })).toMatchObject({
      mode: 'subscription',
      customer_email: 'maker@example.com',
      client_reference_id: 'user_123',
      line_items: [{ price: 'price_123', quantity: 1 }],
      success_url: 'https://cardforge.example/account?checkout=success',
      cancel_url: 'https://cardforge.example/account?checkout=cancelled',
      metadata: {
        clerkUserId: 'user_123',
        product: 'cardforge-studio-export',
        storageModel: 'local-only',
      },
      subscription_data: {
        metadata: {
          clerkUserId: 'user_123',
          product: 'cardforge-studio-export',
        },
      },
    });
  });
});
