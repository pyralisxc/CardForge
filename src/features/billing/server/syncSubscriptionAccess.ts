import { clerkClient } from '@clerk/nextjs/server';
import type Stripe from 'stripe';

import {
  buildStripePaidAccessMetadata,
  buildStripeRevokedAccessMetadata,
  getPaidPlanForProductAccessOffering,
  shouldRevokeStripePaidAccessForSubscription,
} from '../lib/billing';
import { acquireBillingEntitlementLock, releaseBillingEntitlementLock } from '../lib/billingEventStore';
import { classifySubscriptionBillingPurpose, resolveCurrentProductEntitlement } from '../lib/billingPurpose';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

const objectId = (value: string | { id: string } | null) => typeof value === 'string' ? value : value?.id;
const prices = () => ({
  creatorPassPriceId: process.env.STRIPE_CREATOR_PASS_PRICE_ID,
  designerPassPriceId: process.env.STRIPE_DESIGNER_PASS_PRICE_ID,
});

// Both webhook delivery and owner repair project current Stripe state through
// this one account lock. The ledger supplies identities, never entitlement state.
export const syncSubscriptionAccess = async (
  subscriptionId: string,
  stripe: Stripe,
  checkoutSessionId?: string,
): Promise<'paid' | 'free' | 'unchanged'> => {
  const initial = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = initial.metadata?.clerkUserId;
  if (!userId || classifySubscriptionBillingPurpose({ subscription: initial, prices: prices() }).purpose !== 'product_access') {
    return 'unchanged';
  }
  const token = await acquireBillingEntitlementLock({ clerkUserId: userId });
  if (!token) throw new Error('Another product entitlement update is still processing.');
  const acquiredAt = Date.now();
  try {
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    if (current.metadata?.clerkUserId !== userId) throw new Error('The product entitlement owner changed while processing.');
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existingMetadata = user.privateMetadata ?? {};
    const customerIds = new Set<string>();
    const addCustomer = (id: unknown) => { if (typeof id === 'string' && id) customerIds.add(id); };
    addCustomer(objectId(current.customer));
    addCustomer(existingMetadata.cardforgeStripeCustomerId);
    const supabase = getSupabaseServerClient();
    if (!supabase) throw new Error('Billing storage is not configured.');
    // Checkout can create more than one Stripe customer for the same account.
    // Read the existing mapping in full so an older customer's live plan counts.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('cardforge_billing_subscriptions')
        .select('stripe_customer_id').eq('clerk_user_id', userId)
        .order('stripe_subscription_id').range(offset, offset + 999);
      if (error) throw error;
      for (const row of data ?? []) addCustomer(row.stripe_customer_id);
      if ((data?.length ?? 0) < 1000) break;
    }
    const subscriptions: Stripe.Subscription[] = [];
    for (const customer of customerIds) {
      let startingAfter: string | undefined;
      for (;;) {
        const page = await stripe.subscriptions.list({ customer, status: 'all', limit: 100, starting_after: startingAfter });
        subscriptions.push(...page.data);
        if (!page.has_more) break;
        const last = page.data.at(-1)?.id;
        if (!last || last === startingAfter) throw new Error('Stripe subscription pagination did not complete.');
        startingAfter = last;
      }
    }
    const resolution = resolveCurrentProductEntitlement({ current, customerSubscriptions: subscriptions, prices: prices() });
    let next: Record<string, unknown>;
    if (resolution.action === 'paid') {
      const subscription = resolution.subscription as Stripe.Subscription;
      const classification = classifySubscriptionBillingPurpose({ subscription, prices: prices() });
      if (classification.offering !== 'creator_pass' && classification.offering !== 'designer_pass') {
        throw new Error('The active product subscription no longer matches a configured CardForge plan.');
      }
      next = buildStripePaidAccessMetadata({ existingMetadata,
        paidPlan: getPaidPlanForProductAccessOffering(classification.offering),
        stripeCustomerId: objectId(subscription.customer), stripeSubscriptionId: subscription.id,
        stripeCheckoutSessionId: checkoutSessionId,
      });
    } else if (resolution.action === 'free' && shouldRevokeStripePaidAccessForSubscription(existingMetadata, resolution.subscription.id)) {
      next = buildStripeRevokedAccessMetadata(existingMetadata);
    } else return 'unchanged';
    const changed = Object.keys(next).some((key) => key !== 'cardforgeStripeAccessUpdatedAt'
      && JSON.stringify(next[key]) !== JSON.stringify(existingMetadata[key]));
    if (!changed) return 'unchanged';
    // Do not revive an expired lease using a stale provider/account snapshot.
    if (Date.now() - acquiredAt >= 30_000) throw new Error('The entitlement read took too long. Retry with current state.');
    await clerk.users.updateUserMetadata(userId, { privateMetadata: next });
    return resolution.action === 'paid' ? 'paid' : 'free';
  } finally {
    await releaseBillingEntitlementLock({ clerkUserId: userId, leaseToken: token });
  }
};
