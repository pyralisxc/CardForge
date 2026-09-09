import { clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { syncSubscriptionAccess } from './syncSubscriptionAccess';

import {
  BillingGrantConfirmationRequiredError,
  shouldGrantAccessForStripeSubscriptionStatus,
  classifySubscriptionBillingPurpose,
} from '@/features/billing/server';
import {
  buildMissingBillingSubscriptionBaselines,
  establishBillingSubscriptionBaselines,
  findExactClerkUserByEmail,
  getStripeCustomerEmail,
  isClerkUserNotFoundError,
  persistBillingSubscriptionClerkMapping,
  repairStripeSubscriptionClerkMapping,
} from '@/features/billing/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export async function reconcileBillingState() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return createApiErrorResponse(503, 'billing_not_configured', 'Stripe is not configured.');
  }
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return createApiErrorResponse(503, 'billing_not_configured', 'Billing storage is not configured.');
  }

  try {
    const reconciledAt = new Date();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const clerk = await clerkClient();
    const subscriptions: Stripe.Subscription[] = [];
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.subscriptions.list({
        status: 'all',
        limit: 100,
        starting_after: startingAfter,
        expand: ['data.customer'],
      });
      subscriptions.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data.at(-1)?.id;
    }
    const prices = {
      creatorPassPriceId: process.env.STRIPE_CREATOR_PASS_PRICE_ID,
      designerPassPriceId: process.env.STRIPE_DESIGNER_PASS_PRICE_ID,
      supportCurrency: process.env.STRIPE_SUPPORT_CURRENCY,
      supportMonthlyPriceIds: {
        100: process.env.STRIPE_SUPPORT_MONTHLY_1_PRICE_ID,
        500: process.env.STRIPE_SUPPORT_MONTHLY_5_PRICE_ID,
        1000: process.env.STRIPE_SUPPORT_MONTHLY_10_PRICE_ID,
        2000: process.env.STRIPE_SUPPORT_MONTHLY_20_PRICE_ID,
      },
    };
    const classifiedSubscriptions = subscriptions.map((subscription) => ({
      classification: classifySubscriptionBillingPurpose({ subscription, prices }),
      subscription,
    }));
    const productSubscriptions = classifiedSubscriptions
      .filter(({ classification }) => classification.purpose === 'product_access')
      .map(({ subscription }) => subscription);
    const subscriptionIds = productSubscriptions.map((subscription) => subscription.id);
    const ledgerSubscriptionIds = new Set<string>();
    let ledgerCreated = 0;
    if (subscriptionIds.length > 0) {
      const { data, error } = await supabase
        .from('cardforge_billing_subscriptions')
        .select('stripe_subscription_id')
        .in('stripe_subscription_id', subscriptionIds);
      if (error) throw error;
      for (const row of data ?? []) {
        if (typeof row.stripe_subscription_id === 'string') ledgerSubscriptionIds.add(row.stripe_subscription_id);
      }

      const baselines = buildMissingBillingSubscriptionBaselines({
        subscriptions: productSubscriptions,
        existingSubscriptionIds: ledgerSubscriptionIds,
        reconciledAt,
      });
      if (baselines.length > 0) {
        await establishBillingSubscriptionBaselines({ client: supabase, rows: baselines });

        const { data: verifiedRows, error: verificationError } = await supabase
          .from('cardforge_billing_subscriptions')
          .select('stripe_subscription_id')
          .in('stripe_subscription_id', subscriptionIds);
        if (verificationError) throw verificationError;
        for (const row of verifiedRows ?? []) {
          if (typeof row.stripe_subscription_id === 'string') ledgerSubscriptionIds.add(row.stripe_subscription_id);
        }
        ledgerCreated = baselines.filter((row) => ledgerSubscriptionIds.has(row.stripe_subscription_id)).length;
      }
    }

    let repaired = 0;
    let unchanged = 0;
    let missingClerkUser = 0;
    let mappingRepaired = 0;
    let needsCustomerSignIn = 0;
    let ambiguousClerkUsers = 0;
    const mappedSubscriptionIds: string[] = [];
    for (const subscription of productSubscriptions) {
      let userId = subscription.metadata?.clerkUserId;
      let user;
      let shouldRepairMapping = false;
      if (userId) {
        try {
          user = await clerk.users.getUser(userId);
        } catch (error) {
          if (!isClerkUserNotFoundError(error)) throw error;
        }
      }

      if (!user) {
        if (!shouldGrantAccessForStripeSubscriptionStatus(subscription.status)) {
          missingClerkUser += 1;
          continue;
        }
        const customerEmail = await getStripeCustomerEmail({
          customer: subscription.customer,
          retrieve: (customerId) => stripe.customers.retrieve(customerId),
        });
        if (!customerEmail) {
          missingClerkUser += 1;
          needsCustomerSignIn += 1;
          continue;
        }
        const match = await findExactClerkUserByEmail({
          clerk,
          email: customerEmail,
        });
        if (match.kind === 'missing') {
          missingClerkUser += 1;
          needsCustomerSignIn += 1;
          continue;
        }
        if (match.kind === 'ambiguous') {
          missingClerkUser += 1;
          ambiguousClerkUsers += 1;
          continue;
        }
        userId = match.user.id;
        user = await clerk.users.getUser(userId);
        shouldRepairMapping = subscription.metadata?.clerkUserId !== userId;
      }

      if (shouldRepairMapping) {
        await repairStripeSubscriptionClerkMapping({
          stripe,
          subscription,
          clerkUserId: userId,
        });
        await persistBillingSubscriptionClerkMapping({
          client: supabase as unknown as Parameters<typeof persistBillingSubscriptionClerkMapping>[0]['client'],
          subscriptionId: subscription.id,
          clerkUserId: userId,
          updatedAt: new Date(),
        });
        mappingRepaired += 1;
      }
      mappedSubscriptionIds.push(subscription.id);
    }
    // Finish identity repair before projecting any account's plans. Otherwise a
    // still-unmapped active subscription could be missed while processing an old cancellation.
    for (const subscriptionId of mappedSubscriptionIds) {
      const outcome = await syncSubscriptionAccess(subscriptionId, stripe);
      if (outcome === 'unchanged') unchanged += 1;
      else repaired += 1;
    }

    return createNoStoreJsonResponse({
      checked: subscriptions.length,
      productSubscriptionsChecked: productSubscriptions.length,
      supportSubscriptionsSkipped: classifiedSubscriptions.filter(({ classification }) => (
        classification.purpose === 'creator_support'
      )).length,
      unmatchedSubscriptions: classifiedSubscriptions.filter(({ classification }) => (
        classification.purpose === 'unmatched'
      )).length,
      repaired,
      unchanged,
      missingClerkUser,
      mappingRepaired,
      needsCustomerSignIn,
      ambiguousClerkUsers,
      ledgerCreated,
      missingLedger: subscriptionIds.filter((id) => !ledgerSubscriptionIds.has(id)).length,
      hasMore: false,
    });
  } catch (error) {
    if (error instanceof BillingGrantConfirmationRequiredError) {
      return createApiErrorResponse(409, 'owner_operations_conflict', error.message);
    }
    console.error('Failed to reconcile billing state:', error);
    return createApiErrorResponse(500, 'owner_billing_unavailable', 'Unable to reconcile Stripe and account entitlements.');
  }
}
