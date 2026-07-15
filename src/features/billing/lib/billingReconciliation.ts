type ReconciliationSubscription = {
  id: string;
  customer: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

type ClerkUserSummary = {
  id: string;
};

interface ClerkEmailLookupClient {
  users: {
    getUserList: (params: {
      emailAddress: string[];
      limit: number;
    }) => Promise<{
      data: ClerkUserSummary[];
      totalCount: number;
    }>;
  };
}

interface ClerkUserIdLookupClient {
  users: {
    getUserList: (params: {
      userId: string[];
      limit: number;
    }) => Promise<{
      data: ClerkUserSummary[];
      totalCount: number;
    }>;
  };
}

export const findExistingClerkUserIds = async ({
  clerk,
  userIds,
}: {
  clerk: ClerkUserIdLookupClient;
  userIds: string[];
}): Promise<Set<string>> => {
  const existingUserIds = new Set<string>();
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  for (let offset = 0; offset < uniqueUserIds.length; offset += 100) {
    const pageUserIds = uniqueUserIds.slice(offset, offset + 100);
    const result = await clerk.users.getUserList({
      userId: pageUserIds,
      limit: 100,
    });
    for (const user of result.data) existingUserIds.add(user.id);
  }
  return existingUserIds;
};

export type ExactClerkUserMatch =
  | { kind: 'matched'; user: ClerkUserSummary }
  | { kind: 'missing' }
  | { kind: 'ambiguous' };

export const findExactClerkUserByEmail = async ({
  clerk,
  email,
}: {
  clerk: ClerkEmailLookupClient;
  email: string;
}): Promise<ExactClerkUserMatch> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { kind: 'missing' };
  const result = await clerk.users.getUserList({
    emailAddress: [normalizedEmail],
    limit: 2,
  });
  if (result.data.length === 0) return { kind: 'missing' };
  if (result.data.length !== 1 || result.totalCount > 1) return { kind: 'ambiguous' };
  return { kind: 'matched', user: result.data[0] };
};

type StripeCustomerRef = string | {
  id: string;
  email?: string | null;
  deleted?: boolean | void;
} | null;

export const getStripeCustomerEmail = async ({
  customer,
  retrieve,
}: {
  customer: StripeCustomerRef;
  retrieve: (customerId: string) => Promise<{
    email?: string | null;
    deleted?: boolean | void;
  }>;
}): Promise<string | null> => {
  if (!customer) return null;
  const resolved = typeof customer === 'string'
    ? await retrieve(customer)
    : customer;
  return resolved.deleted === true ? null : resolved.email?.trim().toLowerCase() ?? null;
};

interface StripeSubscriptionMappingClient {
  subscriptions: {
    update: (
      subscriptionId: string,
      params: { metadata: Record<string, string> },
    ) => Promise<unknown>;
  };
}

export const repairStripeSubscriptionClerkMapping = async ({
  stripe,
  subscription,
  clerkUserId,
}: {
  stripe: StripeSubscriptionMappingClient;
  subscription: {
    id: string;
    metadata?: Record<string, string> | null;
  };
  clerkUserId: string;
}): Promise<void> => {
  await stripe.subscriptions.update(subscription.id, {
    metadata: {
      ...(subscription.metadata ?? {}),
      clerkUserId,
    },
  });
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

interface BillingSubscriptionMappingClient {
  from: (table: string) => {
    update: (values: {
      clerk_user_id: string;
      updated_at: string;
    }) => {
      eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
    };
  };
}

const getObjectId = (value: string | { id: string } | null): string | null =>
  typeof value === 'string' ? value : value?.id ?? null;

export const isClerkUserNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { clerkError?: unknown; status?: unknown };
  return candidate.clerkError === true && candidate.status === 404;
};

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

export const persistBillingSubscriptionClerkMapping = async ({
  client,
  subscriptionId,
  clerkUserId,
  updatedAt,
}: {
  client: BillingSubscriptionMappingClient;
  subscriptionId: string;
  clerkUserId: string;
  updatedAt: Date;
}): Promise<void> => {
  const { error } = await client
    .from('cardforge_billing_subscriptions')
    .update({
      clerk_user_id: clerkUserId,
      updated_at: updatedAt.toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);
  if (error) throw error;
};
