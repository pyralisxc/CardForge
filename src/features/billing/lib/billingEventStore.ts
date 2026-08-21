import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

type BillingEventDecision = 'accepted' | 'duplicate' | 'pending' | 'stale';
type BillingEventStatus = 'processed' | 'ignored' | 'failed';

interface BillingRpcClient {
  rpc: (
    name: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

interface BillingUpdateClient {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
    };
  };
}

export interface BillingLedgerMetrics {
  failedEvents: number;
  pendingEvents: number;
  unmatchedEvents: number;
}

interface BillingLedgerReadClient {
  from: (table: string) => {
    select: (columns: string) => {
      gte: (column: string, value: string) => {
        limit: (value: number) => PromiseLike<{
          data: Array<{ billing_purpose?: unknown; processing_status?: unknown }> | null;
          error: unknown;
        }>;
      };
    };
  };
}

const requireClient = <T>(client: T | null): T => {
  if (!client) throw new Error('Billing event storage is not configured.');
  return client;
};

export const acquireBillingEntitlementLock = async ({
  clerkUserId,
  leaseToken = crypto.randomUUID(),
  client = getSupabaseServerClient(),
}: {
  clerkUserId: string;
  leaseToken?: string;
  client?: BillingRpcClient | null;
}): Promise<string | null> => {
  const { data, error } = await requireClient(client).rpc('cardforge_acquire_billing_entitlement_lock', {
    p_clerk_user_id: clerkUserId,
    p_lease_token: leaseToken,
    p_lease_seconds: 60,
  });
  if (error || typeof data !== 'boolean') {
    console.error('Unable to acquire billing entitlement lock:', error);
    throw new Error('Unable to serialize the product entitlement update.');
  }
  return data ? leaseToken : null;
};

export const releaseBillingEntitlementLock = async ({
  clerkUserId,
  leaseToken,
  client = getSupabaseServerClient(),
}: {
  clerkUserId: string;
  leaseToken: string;
  client?: BillingRpcClient | null;
}): Promise<void> => {
  const { data, error } = await requireClient(client).rpc('cardforge_release_billing_entitlement_lock', {
    p_clerk_user_id: clerkUserId,
    p_lease_token: leaseToken,
  });
  if (error || data !== true) {
    console.error('Unable to release billing entitlement lock:', error);
    throw new Error('Unable to release the product entitlement lock.');
  }
};

export const beginBillingEvent = async ({
  eventId,
  eventCreated,
  eventType,
  customerId,
  subscriptionId,
  clerkUserId,
  billingPurpose,
  billingOffering,
  stripePriceId,
  amountCents,
  currency,
  classificationReason,
  client = getSupabaseServerClient(),
}: {
  eventId: string;
  eventCreated: number;
  eventType: string;
  customerId: string | null;
  subscriptionId: string | null;
  clerkUserId: string | null;
  billingPurpose: 'product_access' | 'creator_support' | 'unmatched';
  billingOffering: 'creator_pass' | 'designer_pass' | 'support_one_time' | 'support_monthly' | null;
  stripePriceId: string | null;
  amountCents: number | null;
  currency: string | null;
  classificationReason: string | null;
  client?: BillingRpcClient | null;
}): Promise<BillingEventDecision> => {
  const { data, error } = await requireClient(client).rpc('cardforge_begin_billing_event_v2', {
    p_stripe_event_id: eventId,
    p_stripe_created: eventCreated,
    p_event_type: eventType,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_clerk_user_id: clerkUserId,
    p_billing_purpose: billingPurpose,
    p_billing_offering: billingOffering,
    p_stripe_price_id: stripePriceId,
    p_amount_cents: amountCents,
    p_currency: currency,
    p_classification_reason: classificationReason,
  });
  if (error || (data !== 'accepted' && data !== 'duplicate' && data !== 'pending' && data !== 'stale')) {
    console.error('Unable to begin durable billing event:', error);
    throw new Error('Unable to record the Stripe event.');
  }
  return data;
};

export const finishBillingEvent = async ({
  eventId,
  status,
  resultingEntitlement = null,
  failureMessage = null,
  client = getSupabaseServerClient(),
}: {
  eventId: string;
  status: BillingEventStatus;
  resultingEntitlement?: string | null;
  failureMessage?: string | null;
  client?: BillingUpdateClient | null;
}): Promise<void> => {
  const { error } = await requireClient(client)
    .from('cardforge_billing_events')
    .update({
      processing_status: status,
      resulting_entitlement: resultingEntitlement,
      failure_message: failureMessage?.slice(0, 1000) ?? null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId);
  if (error) {
    console.error('Unable to finish durable billing event:', error);
    throw new Error('Unable to finalize the Stripe event ledger.');
  }
};

export const getBillingLedgerMetrics = async ({
  effectiveStart,
  client = getSupabaseServerClient(),
}: {
  effectiveStart: string;
  client?: BillingLedgerReadClient | null;
}): Promise<BillingLedgerMetrics> => {
  const { data, error } = await requireClient(client)
    .from('cardforge_billing_events')
    .select('processing_status,billing_purpose')
    .gte('stripe_created_at', effectiveStart)
    .limit(1000);
  if (error) throw error;
  const rows = data ?? [];
  return {
    failedEvents: rows.filter((row) => row.processing_status === 'failed').length,
    pendingEvents: rows.filter((row) => row.processing_status === 'pending').length,
    unmatchedEvents: rows.filter((row) => row.billing_purpose === 'unmatched').length,
  };
};
