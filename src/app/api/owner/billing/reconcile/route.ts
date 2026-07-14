import { clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';

import {
  buildStripePaidAccessMetadata,
  buildStripeRevokedAccessMetadata,
  shouldGrantAccessForStripeSubscriptionStatus,
  shouldRevokeAccessForStripeSubscriptionStatus,
} from '@/features/billing/lib/billing';
import { getCurrentOwnerAccess } from '@/features/owner/lib/serverOwnerAccess';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const getObjectId = (value: string | { id: string } | null): string | null => (
  typeof value === 'string' ? value : value?.id ?? null
);

export async function POST() {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return createApiErrorResponse(503, 'billing_not_configured', 'Stripe is not configured.');
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const clerk = await clerkClient();
    const subscriptions = await stripe.subscriptions.list({ status: 'all', limit: 100 });
    const subscriptionIds = subscriptions.data.map((subscription) => subscription.id);
    const supabase = getSupabaseServerClient();
    const ledgerSubscriptionIds = new Set<string>();
    if (supabase && subscriptionIds.length > 0) {
      const { data, error } = await supabase
        .from('cardforge_billing_subscriptions')
        .select('stripe_subscription_id')
        .in('stripe_subscription_id', subscriptionIds);
      if (error) throw error;
      for (const row of data ?? []) {
        if (typeof row.stripe_subscription_id === 'string') ledgerSubscriptionIds.add(row.stripe_subscription_id);
      }
    }

    let repaired = 0;
    let unchanged = 0;
    let missingClerkUser = 0;
    for (const subscription of subscriptions.data) {
      const userId = subscription.metadata?.clerkUserId;
      if (!userId) {
        missingClerkUser += 1;
        continue;
      }
      const user = await clerk.users.getUser(userId);
      const existingMetadata = user.privateMetadata ?? {};
      let nextMetadata: Record<string, unknown> | null = null;
      if (shouldGrantAccessForStripeSubscriptionStatus(subscription.status)) {
        const alreadyAligned = existingMetadata.cardforgeAccess === 'paid'
          && existingMetadata.cardforgeStripeSubscriptionId === subscription.id;
        if (!alreadyAligned) {
          nextMetadata = buildStripePaidAccessMetadata({
            existingMetadata,
            stripeCustomerId: getObjectId(subscription.customer),
            stripeSubscriptionId: subscription.id,
          });
        }
      } else if (shouldRevokeAccessForStripeSubscriptionStatus(subscription.status)) {
        if (existingMetadata.cardforgeAccess === 'paid') {
          nextMetadata = buildStripeRevokedAccessMetadata(existingMetadata);
        }
      }

      if (nextMetadata) {
        await clerk.users.updateUserMetadata(userId, { privateMetadata: nextMetadata });
        repaired += 1;
      } else {
        unchanged += 1;
      }
    }

    return createNoStoreJsonResponse({
      checked: subscriptions.data.length,
      repaired,
      unchanged,
      missingClerkUser,
      missingLedger: subscriptionIds.filter((id) => !ledgerSubscriptionIds.has(id)).length,
      hasMore: subscriptions.has_more,
    });
  } catch (error) {
    console.error('Failed to reconcile billing state:', error);
    return createApiErrorResponse(500, 'owner_billing_unavailable', 'Unable to reconcile Stripe and account entitlements.');
  }
}
