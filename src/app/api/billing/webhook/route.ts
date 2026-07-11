import { clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';

import {
  buildStripePaidAccessMetadata,
  buildStripeRevokedAccessMetadata,
  shouldGrantAccessForStripeSubscriptionStatus,
  shouldRevokeAccessForStripeSubscriptionStatus,
} from '@/lib/billing';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';

export const dynamic = 'force-dynamic';

const getStripeObjectId = (value: string | { id: string } | null): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id;
};

const getCheckoutSessionUserId = (session: Stripe.Checkout.Session): string | null =>
  session.client_reference_id ?? session.metadata?.clerkUserId ?? null;

const updateUserPrivateMetadata = async (
  userId: string,
  buildMetadata: (existingMetadata: Record<string, unknown>) => Record<string, unknown>
) => {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  await client.users.updateUserMetadata(userId, {
    privateMetadata: buildMetadata(user.privateMetadata ?? {}),
  });
};

const grantCheckoutSessionAccess = async (session: Stripe.Checkout.Session) => {
  const userId = getCheckoutSessionUserId(session);
  if (!userId) {
    console.warn('Stripe checkout session completed without Clerk user metadata:', session.id);
    return;
  }

  if (session.mode !== 'subscription') return;
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return;

  await updateUserPrivateMetadata(userId, (existingMetadata) => buildStripePaidAccessMetadata({
    existingMetadata,
    stripeCustomerId: getStripeObjectId(session.customer),
    stripeSubscriptionId: getStripeObjectId(session.subscription),
    stripeCheckoutSessionId: session.id,
  }));
};

const syncSubscriptionAccess = async (subscription: Stripe.Subscription) => {
  const userId = subscription.metadata?.clerkUserId ?? null;
  if (!userId) {
    console.warn('Stripe subscription event without Clerk user metadata:', subscription.id);
    return;
  }

  if (shouldGrantAccessForStripeSubscriptionStatus(subscription.status)) {
    await updateUserPrivateMetadata(userId, (existingMetadata) => buildStripePaidAccessMetadata({
      existingMetadata,
      stripeCustomerId: getStripeObjectId(subscription.customer),
      stripeSubscriptionId: subscription.id,
    }));
    return;
  }

  if (shouldRevokeAccessForStripeSubscriptionStatus(subscription.status)) {
    await updateUserPrivateMetadata(userId, buildStripeRevokedAccessMetadata);
  }
};

const handleStripeEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case 'checkout.session.completed':
      await grantCheckoutSessionAccess(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscriptionAccess(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
};

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return createApiErrorResponse(
      503,
      'billing_webhook_unconfigured',
      'Stripe webhook is not configured.'
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return createApiErrorResponse(400, 'billing_webhook_invalid', 'Stripe webhook signature is missing.');
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Invalid Stripe webhook signature:', error);
    return createApiErrorResponse(400, 'billing_webhook_invalid', 'Stripe webhook signature is invalid.');
  }

  try {
    await handleStripeEvent(event);
    return createNoStoreJsonResponse({ received: true });
  } catch (error) {
    console.error('Failed to process Stripe webhook:', error);
    return createApiErrorResponse(500, 'billing_webhook_invalid', 'Unable to process Stripe webhook.');
  }
}
