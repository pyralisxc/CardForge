import { clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';

import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getBillingConfigStatus } from '@/features/billing/server';
import { findExistingClerkUserIds } from '@/features/billing/server';
import {
  buildOwnerBillingSnapshot,
  listStripeCheckoutHistory,
  listStripeSubscriptions,
} from '@/features/owner/server';
import {
  clearOwnerBillingHistory,
  getOwnerBillingHistorySettings,
  OwnerBillingSettingsStoreError,
  updateOwnerBillingHistoryLimit,
} from '@/features/owner/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

const requireOwner = async () => {
  const owner = await getCurrentOwnerAccess();
  return owner.isOwner
    ? null
    : createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
};

const createBillingSettingsErrorResponse = (error: unknown) => {
  if (error instanceof SyntaxError) {
    return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  if (error instanceof OwnerBillingSettingsStoreError) {
    return createApiErrorResponse(
      error.status,
      error.status === 503 ? 'billing_not_configured' : 'owner_request_invalid',
      error.message,
    );
  }
  console.error('Failed to update owner billing history settings:', error);
  return createApiErrorResponse(500, 'owner_billing_unavailable', 'Unable to update billing history settings.');
};

export async function GET(request: Request) {
  const ownerError = await requireOwner();
  if (ownerError) return ownerError;

  const config = getBillingConfigStatus();

  try {
    const historySettings = await getOwnerBillingHistorySettings();
    if (!process.env.STRIPE_SECRET_KEY) {
      return createNoStoreJsonResponse(buildOwnerBillingSnapshot({
        config,
        checkoutSessions: [],
        subscriptions: [],
        historySettings,
      }));
    }

    const includeHistory = new URL(request.url).searchParams.get('includeHistory') === '1';
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const [checkoutSessions, subscriptions] = await Promise.all([
      includeHistory
        ? listStripeCheckoutHistory({
            stripe,
            createdGte: Math.floor(Date.parse(historySettings.effectiveStart) / 1000),
            limit: historySettings.limit,
          })
        : Promise.resolve([]),
      listStripeSubscriptions({ stripe }),
    ]);
    const mappedClerkUserIds = subscriptions
      .map((subscription) => subscription.metadata?.clerkUserId)
      .filter((userId): userId is string => Boolean(userId));
    const existingClerkUserIds = mappedClerkUserIds.length > 0
      ? await findExistingClerkUserIds({
          clerk: await clerkClient(),
          userIds: mappedClerkUserIds,
        })
      : new Set<string>();

    return createNoStoreJsonResponse(buildOwnerBillingSnapshot({
      config,
      checkoutSessions,
      subscriptions,
      historySettings,
      existingClerkUserIds,
    }));
  } catch (error) {
    console.error('Failed to load owner billing summary:', error);
    return createApiErrorResponse(500, 'owner_billing_unavailable', 'Unable to load billing summary.');
  }
}

export async function PUT(request: Request) {
  const ownerError = await requireOwner();
  if (ownerError) return ownerError;

  try {
    const body = await request.json() as { historyLimit?: unknown };
    await updateOwnerBillingHistoryLimit({ value: body.historyLimit });
    return createNoStoreJsonResponse({
      historySettings: await getOwnerBillingHistorySettings(),
    });
  } catch (error) {
    return createBillingSettingsErrorResponse(error);
  }
}

export async function DELETE() {
  const ownerError = await requireOwner();
  if (ownerError) return ownerError;

  try {
    await clearOwnerBillingHistory();
    return createNoStoreJsonResponse({
      historySettings: await getOwnerBillingHistorySettings(),
    });
  } catch (error) {
    return createBillingSettingsErrorResponse(error);
  }
}
