import Stripe from 'stripe';
import { syncSubscriptionAccess } from './syncSubscriptionAccess';

import {
  beginBillingEvent,
  classifyBillingPurpose,
  canBillingPurposeUpdateProductEntitlement,
  finishBillingEvent,
} from '@/features/billing/server';
import type { BillingOffering, ClassifiedBillingPurpose } from '@/features/billing/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

const getStripeObjectId = (value: string | { id: string } | null): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id;
};

const getCheckoutSessionUserId = (session: Stripe.Checkout.Session): string | null =>
  session.client_reference_id ?? session.metadata?.clerkUserId ?? null;

interface BillingEventContext {
  amountCents: number | null;
  billingOffering: BillingOffering | null;
  billingPurpose: ClassifiedBillingPurpose;
  classificationReason: string | null;
  clerkUserId: string | null;
  currency: string | null;
  customerId: string | null;
  stripePriceId: string | null;
  subscriptionId: string | null;
}
const unmatchedContext = (reason: string): BillingEventContext => ({
  amountCents: null,
  billingOffering: null,
  billingPurpose: 'unmatched',
  classificationReason: reason,
  clerkUserId: null,
  currency: null,
  customerId: null,
  stripePriceId: null,
  subscriptionId: null,
});

const getBillingPriceConfiguration = () => ({
  creatorPassPriceId: process.env.STRIPE_CREATOR_PASS_PRICE_ID,
  designerPassPriceId: process.env.STRIPE_DESIGNER_PASS_PRICE_ID,
  supportCurrency: process.env.STRIPE_SUPPORT_CURRENCY,
  supportMonthlyPriceIds: {
    100: process.env.STRIPE_SUPPORT_MONTHLY_1_PRICE_ID,
    500: process.env.STRIPE_SUPPORT_MONTHLY_5_PRICE_ID,
    1000: process.env.STRIPE_SUPPORT_MONTHLY_10_PRICE_ID,
    2000: process.env.STRIPE_SUPPORT_MONTHLY_20_PRICE_ID,
  },
});

const getBillingEventContext = async (event: Stripe.Event, stripe: Stripe): Promise<BillingEventContext> => {
  const prices = getBillingPriceConfiguration();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    const priceIds = lineItems.data
      .map((lineItem) => lineItem.price?.id)
      .filter((priceId): priceId is string => Boolean(priceId));
    const classification = classifyBillingPurpose({
      metadata: session.metadata,
      mode: session.mode,
      priceIds,
      amountCents: session.amount_total,
      currency: session.currency,
      prices,
    });
    return {
      amountCents: session.amount_total,
      billingOffering: classification.offering,
      billingPurpose: classification.purpose,
      classificationReason: classification.reason,
      customerId: getStripeObjectId(session.customer),
      subscriptionId: getStripeObjectId(session.subscription),
      clerkUserId: getCheckoutSessionUserId(session),
      currency: session.currency,
      stripePriceId: priceIds.length === 1 ? priceIds[0] : null,
    };
  }
  if (
    event.type === 'customer.subscription.created'
    || event.type === 'customer.subscription.updated'
    || event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const firstPrice = subscription.items.data[0]?.price;
    const priceIds = subscription.items.data.map(({ price }) => price.id);
    const classification = classifyBillingPurpose({
      metadata: subscription.metadata,
      mode: 'subscription',
      priceIds,
      amountCents: firstPrice?.unit_amount,
      currency: firstPrice?.currency,
      prices,
    });
    return {
      amountCents: firstPrice?.unit_amount ?? null,
      billingOffering: classification.offering,
      billingPurpose: classification.purpose,
      classificationReason: classification.reason,
      customerId: getStripeObjectId(subscription.customer),
      subscriptionId: subscription.id,
      clerkUserId: subscription.metadata?.clerkUserId ?? null,
      currency: firstPrice?.currency ?? null,
      stripePriceId: priceIds.length === 1 ? priceIds[0] : null,
    };
  }
  return unmatchedContext(`Unsupported Stripe event type: ${event.type}`);
};

const handleStripeEvent = async (
  event: Stripe.Event,
  context: BillingEventContext,
  stripe: Stripe,
): Promise<'paid' | 'free' | 'unchanged'> => {
  if (!canBillingPurposeUpdateProductEntitlement(context.billingPurpose)) return 'unchanged';
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      return context.subscriptionId
        ? syncSubscriptionAccess(context.subscriptionId, stripe, session.id)
        : 'unchanged';
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscriptionAccess((event.data.object as Stripe.Subscription).id, stripe);
    default:
      return 'unchanged';
  }
};

export async function processStripeWebhook(request: Request) {
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
  let stripe: Stripe;
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
    const context = await getBillingEventContext(event, stripe);
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
      if (context.billingPurpose === 'unmatched') {
        await finishBillingEvent({ eventId: event.id, status: 'ignored' });
        return createNoStoreJsonResponse({
          received: true,
          decision,
          billingPurpose: 'unmatched',
        });
      }

      const resultingEntitlement = await handleStripeEvent(event, context, stripe);
      await finishBillingEvent({
        eventId: event.id,
        status: 'processed',
        resultingEntitlement,
      });
      return createNoStoreJsonResponse({
        received: true,
        decision,
        billingPurpose: context.billingPurpose,
        resultingEntitlement,
      });
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
