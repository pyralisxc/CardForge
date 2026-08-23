import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';

import {
  buildProductAccessCheckoutSessionParams,
  getBillingConfigStatus,
  normalizeProductAccessOffering,
} from '@/features/billing/server';
import { isClerkAuthConfigured } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!isClerkAuthConfigured()) {
      return createApiErrorResponse(
        503,
        'account_auth_unconfigured',
        'Account sign-in is temporarily unavailable.',
        { nextAction: 'Try again later or contact CardForge support.' },
      );
    }

    const user = await currentUser();
    if (!user) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in before starting checkout.');
    }

    const rawBody = await request.text();
    let requestedOffering: unknown = 'creator_pass';
    if (rawBody.trim()) {
      try {
        requestedOffering = (JSON.parse(rawBody) as { offering?: unknown }).offering ?? 'creator_pass';
      } catch {
        return createApiErrorResponse(400, 'billing_checkout_failed', 'Choose a valid CardForge plan.');
      }
    }
    const offering = normalizeProductAccessOffering(requestedOffering);
    if (!offering) {
      return createApiErrorResponse(400, 'billing_checkout_failed', 'Choose a valid CardForge plan.');
    }

    const config = getBillingConfigStatus();
    const isConfigured = offering === 'designer_pass'
      ? config.designerPassConfigured
      : config.productAccessConfigured;
    if (!isConfigured) {
      return createApiErrorResponse(
        503,
        'billing_not_configured',
        'Secure checkout is temporarily unavailable.',
        { nextAction: 'Try again later or contact CardForge support if this plan should be available.' },
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const primaryEmail = user.emailAddresses[0]?.emailAddress ?? null;
    const priceId = offering === 'designer_pass'
      ? process.env.STRIPE_DESIGNER_PASS_PRICE_ID!
      : process.env.STRIPE_CREATOR_PASS_PRICE_ID!;
    const session = await stripe.checkout.sessions.create(buildProductAccessCheckoutSessionParams({
      appUrl: getPublicAppUrl(),
      email: primaryEmail,
      offering,
      priceId,
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
