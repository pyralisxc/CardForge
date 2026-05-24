import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';

import {
  buildCheckoutSessionParams,
  getBillingConfigStatus,
} from '@/lib/billing';
import { isClerkAuthConfigured } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    if (!isClerkAuthConfigured()) {
      return createApiErrorResponse(
        503,
        'account_auth_unconfigured',
        'Account sign-in is not configured. Add Clerk environment variables before testing paid checkout.'
      );
    }

    const user = await currentUser();
    if (!user) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in before starting checkout.');
    }

    const config = getBillingConfigStatus();
    if (!config.checkoutConfigured) {
      return createApiErrorResponse(
        503,
        'billing_not_configured',
        `Stripe checkout is not configured. Missing: ${config.missing.join(', ')}.`
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const primaryEmail = user.emailAddresses[0]?.emailAddress ?? null;
    const session = await stripe.checkout.sessions.create(buildCheckoutSessionParams({
      appUrl: process.env.NEXT_PUBLIC_APP_URL!,
      email: primaryEmail,
      priceId: process.env.STRIPE_PRICE_ID!,
      userId: user.id,
    }));

    if (!session.url) {
      return createApiErrorResponse(
        502,
        'stripe_checkout_url_missing',
        'Stripe did not return a checkout URL.'
      );
    }

    return createNoStoreJsonResponse({ url: session.url });
  } catch (error) {
    console.error('Failed to create Stripe checkout session:', error);
    return createApiErrorResponse(
      500,
      'billing_checkout_failed',
      'Unable to start checkout.'
    );
  }
}
