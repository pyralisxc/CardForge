import { describe, expect, it } from 'vitest';

import {
  buildBillingPortalSessionParams,
  buildCreatorSupportCheckoutSessionParams,
  buildProductAccessCheckoutSessionParams,
  buildStripePaidAccessMetadata,
  buildStripeRevokedAccessMetadata,
  getBillingConfigStatus,
  getCreatorSupportOfferConfiguration,
  getStripeCustomerIdFromMetadata,
  normalizeProductAccessOffering,
  normalizeCreatorSupportOffering,
  normalizeSupportMonthlyAmountCents,
  normalizeSupportOneTimeAmountCents,
  shouldGrantAccessForStripeSubscriptionStatus,
  shouldRevokeStripePaidAccessForSubscription,
  shouldRevokeAccessForStripeSubscriptionStatus,
  validateCreatorSupportPrice,
} from '@/features/billing/lib/billing';

describe('billing', () => {
  it('reports Stripe checkout as configured only when secret key, price, and app URL exist', () => {
    expect(getBillingConfigStatus({
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_CREATOR_PASS_PRICE_ID: 'price_123',
      STRIPE_DESIGNER_PASS_PRICE_ID: 'price_designer',
      STRIPE_SUPPORT_MONTHLY_1_PRICE_ID: 'price_support_1',
      STRIPE_SUPPORT_MONTHLY_5_PRICE_ID: 'price_support_5',
      STRIPE_SUPPORT_MONTHLY_10_PRICE_ID: 'price_support_10',
      STRIPE_SUPPORT_MONTHLY_20_PRICE_ID: 'price_support_20',
      STRIPE_SUPPORT_CURRENCY: 'usd',
      STRIPE_SUPPORT_PORTAL_URL: 'https://billing.stripe.com/p/login/test',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      NEXT_PUBLIC_APP_URL: 'https://cardforge.example',
    })).toEqual({
      designerPassConfigured: true,
      productAccessConfigured: true,
      supportOneTimeConfigured: true,
      supportMonthlyConfigured: true,
      supportConfigured: true,
      webhookConfigured: true,
      missingProductAccess: [],
      missingDesignerPass: [],
      missingSupport: [],
    });

    expect(getBillingConfigStatus({
      STRIPE_SECRET_KEY: 'sk_test_123',
    })).toEqual({
      designerPassConfigured: false,
      productAccessConfigured: false,
      supportOneTimeConfigured: false,
      supportMonthlyConfigured: false,
      supportConfigured: false,
      webhookConfigured: false,
      missingProductAccess: ['STRIPE_CREATOR_PASS_PRICE_ID', 'NEXT_PUBLIC_APP_URL'],
      missingDesignerPass: ['STRIPE_DESIGNER_PASS_PRICE_ID', 'NEXT_PUBLIC_APP_URL'],
      missingSupport: [
        'STRIPE_SUPPORT_MONTHLY_1_PRICE_ID',
        'STRIPE_SUPPORT_MONTHLY_5_PRICE_ID',
        'STRIPE_SUPPORT_MONTHLY_10_PRICE_ID',
        'STRIPE_SUPPORT_MONTHLY_20_PRICE_ID',
        'STRIPE_SUPPORT_CURRENCY',
        'STRIPE_SUPPORT_PORTAL_URL',
        'NEXT_PUBLIC_APP_URL',
      ],
    });

    expect(getBillingConfigStatus({
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_CREATOR_PASS_PRICE_ID: 'price_123',
      NEXT_PUBLIC_APP_URL: 'https://mpmmhjjhdxjedbmuctiv.supabase.co',
      VERCEL_PROJECT_PRODUCTION_URL: 'card-forge-snowy.vercel.app',
    })).toEqual({
      designerPassConfigured: false,
      productAccessConfigured: true,
      supportOneTimeConfigured: false,
      supportMonthlyConfigured: false,
      supportConfigured: false,
      webhookConfigured: false,
      missingProductAccess: [],
      missingDesignerPass: ['STRIPE_DESIGNER_PASS_PRICE_ID'],
      missingSupport: [
        'STRIPE_SUPPORT_MONTHLY_1_PRICE_ID',
        'STRIPE_SUPPORT_MONTHLY_5_PRICE_ID',
        'STRIPE_SUPPORT_MONTHLY_10_PRICE_ID',
        'STRIPE_SUPPORT_MONTHLY_20_PRICE_ID',
        'STRIPE_SUPPORT_CURRENCY',
        'STRIPE_SUPPORT_PORTAL_URL',
      ],
    });
  });

  it('builds a subscription Checkout session that returns to the local-first app', () => {
    expect(buildProductAccessCheckoutSessionParams({
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
        billingPurpose: 'product_access',
        billingOffering: 'creator_pass',
        storageModel: 'local-only',
      },
      subscription_data: {
        metadata: {
          clerkUserId: 'user_123',
          billingPurpose: 'product_access',
          billingOffering: 'creator_pass',
        },
      },
    });
  });

  it('builds Designer Pass checkout from the server-owned price and preserves the paid plan', () => {
    expect(normalizeProductAccessOffering('designer_pass')).toBe('designer_pass');
    expect(normalizeProductAccessOffering('unknown')).toBeNull();
    expect(buildProductAccessCheckoutSessionParams({
      appUrl: 'https://cardforge.example/',
      offering: 'designer_pass',
      priceId: 'price_designer',
      userId: 'user_123',
      email: 'designer@example.com',
    })).toMatchObject({
      mode: 'subscription',
      line_items: [{ price: 'price_designer', quantity: 1 }],
      metadata: {
        billingPurpose: 'product_access',
        billingOffering: 'designer_pass',
      },
      subscription_data: {
        metadata: {
          billingPurpose: 'product_access',
          billingOffering: 'designer_pass',
        },
      },
    });

    expect(buildStripePaidAccessMetadata({
      paidPlan: 'designer',
      stripeSubscriptionId: 'sub_designer',
    })).toMatchObject({
      cardforgeAccess: 'paid',
      cardforgePaidPlan: 'designer',
      cardforgeStripeSubscriptionId: 'sub_designer',
    });
  });

  it('builds one-time and monthly creator support without product entitlement metadata', () => {
    expect(buildCreatorSupportCheckoutSessionParams({
      appUrl: 'https://cardforge.example/',
      offering: 'support_one_time',
      amountCents: 725,
      currency: 'usd',
      email: 'supporter@example.com',
    })).toMatchObject({
      mode: 'payment',
      customer_creation: 'always',
      customer_email: 'supporter@example.com',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: 725,
          product_data: { name: 'Support Cameron — one time' },
        },
        quantity: 1,
      }],
      success_url: 'https://cardforge.example/cameron?payment=success#support',
      cancel_url: 'https://cardforge.example/cameron?payment=cancelled#support',
      metadata: {
        billingPurpose: 'creator_support',
        billingOffering: 'support_one_time',
      },
      payment_intent_data: {
        metadata: {
          billingPurpose: 'creator_support',
          billingOffering: 'support_one_time',
        },
      },
    });

    expect(buildCreatorSupportCheckoutSessionParams({
      appUrl: 'https://cardforge.example',
      priceId: 'price_monthly',
      offering: 'support_monthly',
      amountCents: 1000,
      currency: 'usd',
      userId: 'user_optional',
    })).toMatchObject({
      mode: 'subscription',
      line_items: [{ price: 'price_monthly', quantity: 1 }],
      metadata: {
        billingPurpose: 'creator_support',
        billingOffering: 'support_monthly',
        supportTierAmountCents: '1000',
        clerkUserId: 'user_optional',
      },
      subscription_data: {
        metadata: {
          billingPurpose: 'creator_support',
          billingOffering: 'support_monthly',
          supportTierAmountCents: '1000',
          clerkUserId: 'user_optional',
        },
      },
    });
  });

  it('normalizes support configuration and validates the Stripe price before checkout', () => {
    const offers = getCreatorSupportOfferConfiguration({
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_SUPPORT_MONTHLY_1_PRICE_ID: 'price_1',
      STRIPE_SUPPORT_MONTHLY_5_PRICE_ID: 'price_5',
      STRIPE_SUPPORT_MONTHLY_10_PRICE_ID: 'price_10',
      STRIPE_SUPPORT_MONTHLY_20_PRICE_ID: 'price_20',
      STRIPE_SUPPORT_CURRENCY: 'USD',
      STRIPE_SUPPORT_PORTAL_URL: 'https://billing.stripe.com/p/login/test',
      NEXT_PUBLIC_APP_URL: 'https://cardforge.example',
    });
    expect(offers).toEqual({
      currency: 'usd',
      oneTimeMinimumCents: 100,
      oneTimeMaximumCents: 100000,
      oneTimePresetCents: 500,
      portalUrl: 'https://billing.stripe.com/p/login/test',
      monthlyPriceIds: {
        100: 'price_1',
        500: 'price_5',
        1000: 'price_10',
        2000: 'price_20',
      },
    });
    expect(getCreatorSupportOfferConfiguration({
      STRIPE_SUPPORT_MONTHLY_1_PRICE_ID: 'price_1',
      STRIPE_SUPPORT_MONTHLY_5_PRICE_ID: 'price_5',
      STRIPE_SUPPORT_MONTHLY_10_PRICE_ID: 'price_10',
      STRIPE_SUPPORT_MONTHLY_20_PRICE_ID: 'price_20',
      STRIPE_SUPPORT_CURRENCY: 'usd',
      STRIPE_SUPPORT_PORTAL_URL: 'https://billing.stripe.com/p/login/test',
      NEXT_PUBLIC_APP_URL: 'https://cardforge.example',
    })).toBeNull();
    expect(normalizeCreatorSupportOffering('support_one_time')).toBe('support_one_time');
    expect(normalizeCreatorSupportOffering('creator_pass')).toBeNull();
    expect(normalizeSupportOneTimeAmountCents(100)).toBe(100);
    expect(normalizeSupportOneTimeAmountCents(100_000)).toBe(100_000);
    expect(normalizeSupportOneTimeAmountCents(99)).toBeNull();
    expect(normalizeSupportOneTimeAmountCents(100_001)).toBeNull();
    expect(normalizeSupportOneTimeAmountCents(125.5)).toBeNull();
    expect(normalizeSupportMonthlyAmountCents(100)).toBe(100);
    expect(normalizeSupportMonthlyAmountCents(500)).toBe(500);
    expect(normalizeSupportMonthlyAmountCents(1000)).toBe(1000);
    expect(normalizeSupportMonthlyAmountCents(2000)).toBe(2000);
    expect(normalizeSupportMonthlyAmountCents(1500)).toBeNull();
    expect(validateCreatorSupportPrice({
      offering: 'support_monthly',
      amountCents: 1000,
      configured: offers!,
      price: {
        id: 'price_10',
        active: true,
        currency: 'usd',
        unit_amount: 1000,
        recurring: { interval: 'month' },
      },
    })).toBe(true);
    expect(validateCreatorSupportPrice({
      offering: 'support_monthly',
      amountCents: 1000,
      configured: offers!,
      price: {
        id: 'price_10',
        active: true,
        currency: 'usd',
        unit_amount: 1000,
        recurring: { interval: 'year' },
      },
    })).toBe(false);
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

  it('does not let an older subscription revoke a newer stored Creator Pass', () => {
    expect(shouldRevokeStripePaidAccessForSubscription({
      cardforgeStripeSubscriptionId: 'sub_new',
    }, 'sub_old')).toBe(false);
    expect(shouldRevokeStripePaidAccessForSubscription({
      cardforgeStripeSubscriptionId: 'sub_current',
    }, 'sub_current')).toBe(true);
    expect(shouldRevokeStripePaidAccessForSubscription({}, 'sub_current')).toBe(true);
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
