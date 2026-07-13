import Stripe from 'stripe';

import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { getBillingConfigStatus } from '@/features/billing/lib/billing';
import { buildOwnerBillingSnapshot } from '@/features/owner/lib/ownerBillingOperations';
import { getCurrentOwnerAccess } from '@/features/owner/lib/serverOwnerAccess';

export const dynamic = 'force-dynamic';

export async function GET() {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }

  const config = getBillingConfigStatus();
  if (!process.env.STRIPE_SECRET_KEY) {
    return createNoStoreJsonResponse(buildOwnerBillingSnapshot({
      config,
      checkoutSessions: [],
      subscriptions: [],
    }));
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const [checkoutSessions, subscriptions] = await Promise.all([
      stripe.checkout.sessions.list({ limit: 10 }),
      stripe.subscriptions.list({ limit: 10 }),
    ]);

    return createNoStoreJsonResponse(buildOwnerBillingSnapshot({
      config,
      checkoutSessions: checkoutSessions.data,
      subscriptions: subscriptions.data,
    }));
  } catch (error) {
    console.error('Failed to load owner billing summary:', error);
    return createApiErrorResponse(500, 'owner_billing_unavailable', 'Unable to load billing summary.');
  }
}
