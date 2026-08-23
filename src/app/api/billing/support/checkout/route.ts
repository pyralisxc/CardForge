import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';

import { isClerkAuthConfigured } from '@/features/account/server';
import {
  buildCreatorSupportCheckoutSessionParams,
  getCreatorSupportOfferConfiguration,
  normalizeCreatorSupportOffering,
  normalizeSupportMonthlyAmountCents,
  normalizeSupportOneTimeAmountCents,
  validateCreatorSupportPrice,
} from '@/features/billing/server';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import {
  consumeRateLimit,
  getRequestClientAddress,
  RateLimitUnavailableError,
} from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return createApiErrorResponse(503, 'support_checkout_unconfigured', 'Creator support is not configured.');
    }

    const configured = getCreatorSupportOfferConfiguration();
    if (!configured) {
      return createApiErrorResponse(503, 'support_checkout_unconfigured', 'Creator support is not configured.');
    }

    const body = await request.json() as Record<string, unknown>;
    const offering = normalizeCreatorSupportOffering(body.offering);
    if (!offering) {
      return createApiErrorResponse(400, 'support_offering_invalid', 'Choose one-time or monthly support.');
    }
    const oneTimeAmountCents = offering === 'support_one_time'
      ? normalizeSupportOneTimeAmountCents(body.amountCents)
      : null;
    const monthlyAmountCents = offering === 'support_monthly'
      ? normalizeSupportMonthlyAmountCents(body.amountCents)
      : null;
    const amountCents = oneTimeAmountCents ?? monthlyAmountCents;
    if (amountCents === null) {
      return createApiErrorResponse(400, 'support_amount_invalid', 'Choose a valid support amount.');
    }

    const rateLimit = await consumeRateLimit({
      action: 'creator-support-checkout-ip',
      identity: getRequestClientAddress(request),
      limit: 10,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many checkout attempts.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'creator_support_checkout_attempts',
        maximum: 10,
        unit: 'attempts_per_hour',
      });
    }

    const user = isClerkAuthConfigured() ? await currentUser() : null;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceId = offering === 'support_monthly'
      ? configured.monthlyPriceIds[monthlyAmountCents!]
      : undefined;
    if (offering === 'support_monthly') {
      const price = await stripe.prices.retrieve(priceId!);
      if (!validateCreatorSupportPrice({ offering, amountCents, configured, price })) {
        console.error('Creator support price does not match server configuration:', priceId);
        return createApiErrorResponse(
          503,
          'support_price_mismatch',
          'Creator support is temporarily unavailable while its billing configuration is reviewed.',
        );
      }
    }

    const session = await stripe.checkout.sessions.create(buildCreatorSupportCheckoutSessionParams({
      appUrl: getPublicAppUrl(),
      amountCents,
      currency: configured.currency,
      email: user?.emailAddresses[0]?.emailAddress ?? null,
      offering,
      priceId,
      userId: user?.id ?? null,
    }));
    if (!session.url) {
      return createApiErrorResponse(502, 'stripe_checkout_url_missing', 'Stripe did not return a checkout URL.');
    }

    return createNoStoreJsonResponse({ url: session.url });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'service_unavailable', error.message);
    }
    console.error('Failed to create creator support checkout:', error);
    return createApiErrorResponse(500, 'support_checkout_failed', 'Unable to start creator support checkout.');
  }
}
