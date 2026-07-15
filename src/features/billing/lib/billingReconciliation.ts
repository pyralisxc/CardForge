type ReconciliationSubscription = {
  id: string;
  customer: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export type BillingSubscriptionBaselineRow = {
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  clerk_user_id: string | null;
  last_event_created_at: string;
  last_event_id: string;
  updated_at: string;
};

interface BillingSubscriptionBaselineClient {
  from: (table: string) => {
    upsert: (
      rows: BillingSubscriptionBaselineRow[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => PromiseLike<{ error: unknown }>;
  };
}

const getObjectId = (value: string | { id: string } | null): string | null =>
  typeof value === 'string' ? value : value?.id ?? null;

export const buildMissingBillingSubscriptionBaselines = ({
  subscriptions,
  existingSubscriptionIds,
  reconciledAt,
}: {
  subscriptions: ReconciliationSubscription[];
  existingSubscriptionIds: ReadonlySet<string>;
  reconciledAt: Date;
}): BillingSubscriptionBaselineRow[] => subscriptions
  .filter((subscription) => !existingSubscriptionIds.has(subscription.id))
  .map((subscription) => ({
    stripe_subscription_id: subscription.id,
    stripe_customer_id: getObjectId(subscription.customer),
    clerk_user_id: subscription.metadata?.clerkUserId ?? null,
    last_event_created_at: reconciledAt.toISOString(),
    last_event_id: `reconciliation:${subscription.id}:${reconciledAt.getTime()}`,
    updated_at: reconciledAt.toISOString(),
  }));

export const establishBillingSubscriptionBaselines = async ({
  client,
  rows,
}: {
  client: BillingSubscriptionBaselineClient;
  rows: BillingSubscriptionBaselineRow[];
}): Promise<void> => {
  if (rows.length === 0) return;
  const { error } = await client
    .from('cardforge_billing_subscriptions')
    .upsert(rows, {
      onConflict: 'stripe_subscription_id',
      ignoreDuplicates: true,
    });
  if (error) throw error;
};
