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

const requireClient = <T>(client: T | null): T => {
  if (!client) throw new Error('Billing event storage is not configured.');
  return client;
};

export const beginBillingEvent = async ({
  eventId,
  eventCreated,
  eventType,
  customerId,
  subscriptionId,
  clerkUserId,
  client = getSupabaseServerClient(),
}: {
  eventId: string;
  eventCreated: number;
  eventType: string;
  customerId: string | null;
  subscriptionId: string | null;
  clerkUserId: string | null;
  client?: BillingRpcClient | null;
}): Promise<BillingEventDecision> => {
  const { data, error } = await requireClient(client).rpc('cardforge_begin_billing_event', {
    p_stripe_event_id: eventId,
    p_stripe_created: eventCreated,
    p_event_type: eventType,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_clerk_user_id: clerkUserId,
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
