import { auth, currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';

import { isClerkAuthConfigured } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  buildBillingPortalSessionParams,
  getStripeCustomerIdFromMetadata,
} from '@/features/billing/server';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    if (!isClerkAuthConfigured()) {
      return createApiErrorResponse(
        503,
        'account_auth_unconfigured',
        'Account sign-in is not configured. Add Clerk environment variables before testing billing management.'
      );
    }

    const authState = await auth();
    if (!authState.userId) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in before managing billing.');
    }

    const user = await currentUser();
    if (!user) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in before managing billing.');
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return createApiErrorResponse(
        503,
        'billing_not_configured',
        'Stripe billing management is not configured.'
      );
    }

    const customerId = getStripeCustomerIdFromMetadata(user.privateMetadata ?? {});
    if (!customerId) {
      return createApiErrorResponse(
        403,
        'billing_portal_failed',
        'No Stripe customer record is attached to this account yet.'
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create(buildBillingPortalSessionParams({
      appUrl: getPublicAppUrl(),
      customerId,
    }));

    if (!session.url) {
      return createApiErrorResponse(
        502,
        'stripe_portal_url_missing',
        'Stripe did not return a billing portal URL.'
      );
    }

    return createNoStoreJsonResponse({ url: session.url });
  } catch (error) {
    console.error('Failed to create Stripe billing portal session:', error);
    return createApiErrorResponse(
      500,
      'billing_portal_failed',
      'Unable to open billing management.'
    );
  }
}
