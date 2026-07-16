import { clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';

import {
  buildStripePaidAccessMetadata,
  buildStripeRevokedAccessMetadata,
  shouldGrantAccessForStripeSubscriptionStatus,
  shouldRevokeAccessForStripeSubscriptionStatus,
} from '@/features/billing/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { beginBillingEvent, finishBillingEvent } from '@/features/billing/server';

export const dynamic = 'force-dynamic';

const getStripeObjectId = (value: string | { id: string } | null): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id;
};

const getCheckoutSessionUserId = (session: Stripe.Checkout.Session): string | null =>
  session.client_reference_id ?? session.metadata?.clerkUserId ?? null;

const getBillingEventContext = (event: Stripe.Event) => {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      customerId: getStripeObjectId(session.customer),
      subscriptionId: getStripeObjectId(session.subscription),
      clerkUserId: getCheckoutSessionUserId(session),
    };
  }
  if (
    event.type === 'customer.subscription.created'
    || event.type === 'customer.subscription.updated'
    || event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    return {
      customerId: getStripeObjectId(subscription.customer),
      subscriptionId: subscription.id,
      clerkUserId: subscription.metadata?.clerkUserId ?? null,
    };
  }
  return { customerId: null, subscriptionId: null, clerkUserId: null };
};

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
    return 'unchanged' as const;
  }

  if (session.mode !== 'subscription') return 'unchanged' as const;
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return 'unchanged' as const;

  await updateUserPrivateMetadata(userId, (existingMetadata) => buildStripePaidAccessMetadata({
    existingMetadata,
    stripeCustomerId: getStripeObjectId(session.customer),
    stripeSubscriptionId: getStripeObjectId(session.subscription),
    stripeCheckoutSessionId: session.id,
  }));
  return 'paid' as const;
};

const syncSubscriptionAccess = async (subscription: Stripe.Subscription) => {
  const userId = subscription.metadata?.clerkUserId ?? null;
  if (!userId) {
    console.warn('Stripe subscription event without Clerk user metadata:', subscription.id);
    return 'unchanged' as const;
  }

  if (shouldGrantAccessForStripeSubscriptionStatus(subscription.status)) {
    await updateUserPrivateMetadata(userId, (existingMetadata) => buildStripePaidAccessMetadata({
      existingMetadata,
      stripeCustomerId: getStripeObjectId(subscription.customer),
      stripeSubscriptionId: subscription.id,
    }));
    return 'paid' as const;
  }

  if (shouldRevokeAccessForStripeSubscriptionStatus(subscription.status)) {
    await updateUserPrivateMetadata(userId, buildStripeRevokedAccessMetadata);
    return 'free' as const;
  }
  return 'unchanged' as const;
};

const handleStripeEvent = async (event: Stripe.Event): Promise<'paid' | 'free' | 'unchanged'> => {
  switch (event.type) {
    case 'checkout.session.completed':
      return grantCheckoutSessionAccess(event.data.object as Stripe.Checkout.Session);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscriptionAccess(event.data.object as Stripe.Subscription);
    default:
      return 'unchanged';
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
    const context = getBillingEventContext(event);
    const decision = await beginBillingEvent({
      eventId: event.id,
      eventCreated: event.created,
      eventType: event.type,
      ...context,
    });
    if (decision === 'pending') {
      throw new Error('A prior delivery of this Stripe event is still processing.');
    }
    if (decision === 'duplicate' || decision === 'stale') {
      return createNoStoreJsonResponse({ received: true, decision });
    }

    try {
      const resultingEntitlement = await handleStripeEvent(event);
      await finishBillingEvent({
        eventId: event.id,
        status: 'processed',
        resultingEntitlement,
      });
      return createNoStoreJsonResponse({ received: true, decision, resultingEntitlement });
    } catch (processingError) {
      await finishBillingEvent({
        eventId: event.id,
        status: 'failed',
        failureMessage: processingError instanceof Error ? processingError.message : 'Unknown processing failure',
      });
      throw processingError;
    }
  } catch (error) {
    console.error('Failed to process Stripe webhook:', error);
    return createApiErrorResponse(500, 'billing_webhook_invalid', 'Unable to process Stripe webhook.');
  }
}
