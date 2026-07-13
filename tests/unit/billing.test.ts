import { describe, expect, it } from 'vitest';

import {
  buildBillingPortalSessionParams,
  buildCheckoutSessionParams,
  buildStripePaidAccessMetadata,
  buildStripeRevokedAccessMetadata,
  getBillingConfigStatus,
  getStripeCustomerIdFromMetadata,
  shouldGrantAccessForStripeSubscriptionStatus,
  shouldRevokeAccessForStripeSubscriptionStatus,
} from '@/features/billing/lib/billing';

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

  it('builds a customer billing portal session that returns to account settings', () => {
    expect(buildBillingPortalSessionParams({
      appUrl: 'https://cardforge.example/',
      customerId: 'cus_123',
    })).toEqual({
      customer: 'cus_123',
      return_url: 'https://cardforge.example/account',
    });
  });

  it('reads a Stripe customer id only from trusted private metadata', () => {
    expect(getStripeCustomerIdFromMetadata({
      cardforgeStripeCustomerId: 'cus_123',
    })).toBe('cus_123');
    expect(getStripeCustomerIdFromMetadata({
      cardforgeStripeCustomerId: '  ',
    })).toBeNull();
    expect(getStripeCustomerIdFromMetadata({
      cardforgeStripeCustomerId: 123,
    })).toBeNull();
  });

  it('builds trusted Clerk metadata for Stripe-paid Creator Pass access', () => {
    expect(buildStripePaidAccessMetadata({
      existingMetadata: { cardforgeRole: 'owner', cardforgeAccessExpiresAt: '2026-08-01T00:00:00.000Z' },
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripeCheckoutSessionId: 'cs_123',
    })).toMatchObject({
      cardforgeRole: 'owner',
      cardforgeAccess: 'paid',
      cardforgeAccessExpiresAt: null,
      cardforgeStripeCustomerId: 'cus_123',
      cardforgeStripeSubscriptionId: 'sub_123',
      cardforgeStripeCheckoutSessionId: 'cs_123',
    });
  });

  it('revokes only Stripe-paid access while preserving unrelated private metadata', () => {
    expect(buildStripeRevokedAccessMetadata({
      cardforgeAccess: 'paid',
      cardforgeRole: 'owner',
      cardforgeStripeSubscriptionId: 'sub_123',
    })).toMatchObject({
      cardforgeAccess: 'free',
      cardforgeRole: 'owner',
      cardforgeAccessExpiresAt: null,
      cardforgeStripeSubscriptionId: 'sub_123',
    });

    expect(buildStripeRevokedAccessMetadata({
      cardforgeAccess: 'dev',
      cardforgeRole: 'owner',
    })).toMatchObject({
      cardforgeAccess: 'dev',
      cardforgeRole: 'owner',
      cardforgeAccessExpiresAt: null,
    });
  });

  it('maps Stripe subscription statuses to entitlement actions', () => {
    expect(shouldGrantAccessForStripeSubscriptionStatus('active')).toBe(true);
    expect(shouldGrantAccessForStripeSubscriptionStatus('trialing')).toBe(true);
    expect(shouldGrantAccessForStripeSubscriptionStatus('past_due')).toBe(false);

    expect(shouldRevokeAccessForStripeSubscriptionStatus('canceled')).toBe(true);
    expect(shouldRevokeAccessForStripeSubscriptionStatus('incomplete_expired')).toBe(true);
    expect(shouldRevokeAccessForStripeSubscriptionStatus('unpaid')).toBe(true);
    expect(shouldRevokeAccessForStripeSubscriptionStatus('active')).toBe(false);
  });
});
