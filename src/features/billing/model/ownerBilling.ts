import { getBillingConfigStatus, type BillingConfigStatus } from '@/features/billing/lib/billing';
import type { BillingOffering, ClassifiedBillingPurpose } from '@/features/billing/lib/billingPurpose';
import type { BillingLedgerMetrics } from '@/features/billing/lib/billingEventStore';

type StripeObjectRef = string | {
  id?: string;
  email?: string | null;
  deleted?: boolean | void;
} | null | undefined;

export const DEFAULT_BILLING_HISTORY_LIMIT = 500;
export const MAX_BILLING_HISTORY_LIMIT = 500;
export const BILLING_HISTORY_RETENTION_DAYS = 30;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const normalizeBillingHistoryLimit = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BILLING_HISTORY_LIMIT;
  return Math.min(MAX_BILLING_HISTORY_LIMIT, Math.max(1, Math.trunc(parsed)));
};

export const getEffectiveBillingHistoryStart = ({
  now,
  clearedBefore,
}: {
  now: Date;
  clearedBefore: string | null;
}): string => {
  const retentionStart = now.getTime() - (BILLING_HISTORY_RETENTION_DAYS * MILLISECONDS_PER_DAY);
  const clearedBeforeTime = clearedBefore ? Date.parse(clearedBefore) : Number.NaN;
  return new Date(Math.max(
    retentionStart,
    Number.isFinite(clearedBeforeTime) ? clearedBeforeTime : retentionStart,
  )).toISOString();
};

export interface OwnerBillingHistorySettings {
  limit: number;
  retentionDays: typeof BILLING_HISTORY_RETENTION_DAYS;
  clearedBefore: string | null;
  effectiveStart: string;
}

export const buildOwnerBillingHistorySettings = ({
  limit,
  clearedBefore,
  now = new Date(),
}: {
  limit?: unknown;
  clearedBefore?: string | null;
  now?: Date;
} = {}): OwnerBillingHistorySettings => ({
  limit: normalizeBillingHistoryLimit(limit),
  retentionDays: BILLING_HISTORY_RETENTION_DAYS,
  clearedBefore: clearedBefore ?? null,
  effectiveStart: getEffectiveBillingHistoryStart({
    now,
    clearedBefore: clearedBefore ?? null,
  }),
});

export interface OwnerCheckoutSessionSummary {
  id: string;
  customerId: string | null;
  customerEmail: string | null;
  clerkUserId: string | null;
  mode: string | null;
  paymentStatus: string | null;
  status: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  createdAt: string | null;
  subscriptionId: string | null;
  billingPurpose: ClassifiedBillingPurpose;
  billingOffering: BillingOffering | null;
}

export interface OwnerSubscriptionSummary {
  id: string;
  customerId: string | null;
  customerEmail: string | null;
  clerkUserId: string | null;
  mappingStatus: 'connected' | 'stale' | 'missing' | 'unverified';
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
  amountCents: number | null;
  currency: string | null;
  interval: string | null;
  billingPurpose: ClassifiedBillingPurpose;
  billingOffering: BillingOffering | null;
}

export interface OwnerRefundSummary {
  id: string;
  amountCents: number;
  currency: string;
  createdAt: string | null;
  status: string | null;
}

export interface OwnerBillingMetrics {
  activeCreatorPassSubscriptions: number;
  activeSupportSubscriptions: number;
  creatorPassMrrCents: number;
  supporterRecurringRevenueCents: number;
  oneTimeSupportCents: number;
  refundCount: number;
  refundTotalCents: number;
  unmatchedRecords: number;
  failedEvents: number;
  pendingEvents: number;
}

export interface OwnerBillingSnapshot {
  status: BillingConfigStatus;
  recentCheckoutSessions: OwnerCheckoutSessionSummary[];
  recentSubscriptions: OwnerSubscriptionSummary[];
  recentRefunds: OwnerRefundSummary[];
  metrics: OwnerBillingMetrics;
  historySettings: OwnerBillingHistorySettings;
}

const getObjectId = (value: StripeObjectRef): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return typeof value.id === 'string' ? value.id : null;
};

const getCustomerEmail = (value: StripeObjectRef): string | null => (
  value && typeof value !== 'string' && value.deleted !== true
    ? value.email ?? null
    : null
);

const toIsoFromSeconds = (value: unknown): string | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;

const readBillingMetadata = (
  metadata?: Record<string, string | null> | null,
): { billingPurpose: ClassifiedBillingPurpose; billingOffering: BillingOffering | null } => {
  const purpose = metadata?.billingPurpose;
  const offering = metadata?.billingOffering;
  const billingPurpose: ClassifiedBillingPurpose = purpose === 'product_access' || purpose === 'creator_support'
    ? purpose
    : 'unmatched';
  const billingOffering: BillingOffering | null = offering === 'creator_pass'
    || offering === 'support_one_time'
    || offering === 'support_monthly'
    ? offering
    : null;
  return { billingPurpose, billingOffering };
};

export const mapStripeCheckoutSessionSummary = (session: {
  id: string;
  customer?: StripeObjectRef;
  customer_email?: string | null;
  mode?: string | null;
  payment_status?: string | null;
  status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  created?: number;
  subscription?: StripeObjectRef;
  metadata?: Record<string, string | null> | null;
}): OwnerCheckoutSessionSummary => ({
  id: session.id,
  customerId: getObjectId(session.customer),
  customerEmail: session.customer_email ?? null,
  clerkUserId: session.metadata?.clerkUserId ?? null,
  mode: session.mode ?? null,
  paymentStatus: session.payment_status ?? null,
  status: session.status ?? null,
  amountTotalCents: session.amount_total ?? null,
  currency: session.currency ?? null,
  createdAt: toIsoFromSeconds(session.created),
  subscriptionId: getObjectId(session.subscription),
  ...readBillingMetadata(session.metadata),
});

export const mapStripeSubscriptionSummary = (subscription: {
  id: string;
  customer?: StripeObjectRef;
  status?: string | null;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string | null> | null;
  items?: {
    data?: Array<{
      current_period_end?: number;
      price?: {
        id?: string;
        unit_amount?: number | null;
        currency?: string | null;
        recurring?: { interval?: string | null } | null;
      } | null;
    }>;
  };
}, existingClerkUserIds?: ReadonlySet<string>): OwnerSubscriptionSummary => {
  const price = subscription.items?.data?.[0]?.price ?? null;
  const clerkUserId = subscription.metadata?.clerkUserId ?? null;
  return {
    id: subscription.id,
    customerId: getObjectId(subscription.customer),
    customerEmail: getCustomerEmail(subscription.customer),
    clerkUserId,
    mappingStatus: !clerkUserId
      ? 'missing'
      : existingClerkUserIds === undefined
        ? 'unverified'
        : existingClerkUserIds.has(clerkUserId)
          ? 'connected'
          : 'stale',
    status: subscription.status ?? null,
    currentPeriodEnd: toIsoFromSeconds(
      subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end,
    ),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    priceId: price?.id ?? null,
    amountCents: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    interval: price?.recurring?.interval ?? null,
    ...readBillingMetadata(subscription.metadata),
  };
};

export const mapStripeRefundSummary = (refund: {
  id: string;
  amount: number;
  currency: string;
  created?: number;
  status?: string | null;
}): OwnerRefundSummary => ({
  id: refund.id,
  amountCents: refund.amount,
  currency: refund.currency,
  createdAt: toIsoFromSeconds(refund.created),
  status: refund.status ?? null,
});

const isActive = (status: string | null): boolean => status === 'active' || status === 'trialing';

export const buildOwnerBillingMetrics = ({
  checkoutSessions,
  subscriptions,
  refunds,
  ledgerMetrics = { failedEvents: 0, pendingEvents: 0, unmatchedEvents: 0 },
}: {
  checkoutSessions: OwnerCheckoutSessionSummary[];
  subscriptions: OwnerSubscriptionSummary[];
  refunds: OwnerRefundSummary[];
  ledgerMetrics?: BillingLedgerMetrics;
}): OwnerBillingMetrics => ({
  activeCreatorPassSubscriptions: subscriptions.filter((item) => (
    item.billingPurpose === 'product_access' && isActive(item.status)
  )).length,
  activeSupportSubscriptions: subscriptions.filter((item) => (
    item.billingPurpose === 'creator_support' && isActive(item.status)
  )).length,
  creatorPassMrrCents: subscriptions
    .filter((item) => item.billingPurpose === 'product_access' && isActive(item.status) && item.interval === 'month')
    .reduce((sum, item) => sum + (item.amountCents ?? 0), 0),
  supporterRecurringRevenueCents: subscriptions
    .filter((item) => item.billingPurpose === 'creator_support' && isActive(item.status) && item.interval === 'month')
    .reduce((sum, item) => sum + (item.amountCents ?? 0), 0),
  oneTimeSupportCents: checkoutSessions
    .filter((item) => item.billingPurpose === 'creator_support'
      && item.billingOffering === 'support_one_time'
      && item.paymentStatus === 'paid')
    .reduce((sum, item) => sum + (item.amountTotalCents ?? 0), 0),
  refundCount: refunds.length,
  refundTotalCents: refunds.reduce((sum, refund) => sum + refund.amountCents, 0),
  unmatchedRecords: Math.max(
    ledgerMetrics.unmatchedEvents,
    checkoutSessions.filter((item) => item.billingPurpose === 'unmatched').length
      + subscriptions.filter((item) => item.billingPurpose === 'unmatched').length,
  ),
  failedEvents: ledgerMetrics.failedEvents,
  pendingEvents: ledgerMetrics.pendingEvents,
});

export const buildOwnerBillingSnapshot = ({
  config = getBillingConfigStatus(),
  checkoutSessions,
  subscriptions,
  refunds = [],
  historySettings = buildOwnerBillingHistorySettings(),
  existingClerkUserIds,
  ledgerMetrics,
}: {
  config?: BillingConfigStatus;
  checkoutSessions: Parameters<typeof mapStripeCheckoutSessionSummary>[0][];
  subscriptions: Parameters<typeof mapStripeSubscriptionSummary>[0][];
  refunds?: Parameters<typeof mapStripeRefundSummary>[0][];
  historySettings?: OwnerBillingHistorySettings;
  existingClerkUserIds?: ReadonlySet<string>;
  ledgerMetrics?: BillingLedgerMetrics;
}): OwnerBillingSnapshot => {
  const recentCheckoutSessions = checkoutSessions.map(mapStripeCheckoutSessionSummary);
  const recentSubscriptions = subscriptions.map((subscription) => (
    mapStripeSubscriptionSummary(subscription, existingClerkUserIds)
  ));
  const recentRefunds = refunds.map(mapStripeRefundSummary);
  return {
    status: config,
    recentCheckoutSessions,
    recentSubscriptions,
    recentRefunds,
    metrics: buildOwnerBillingMetrics({
      checkoutSessions: recentCheckoutSessions,
      subscriptions: recentSubscriptions,
      refunds: recentRefunds,
      ledgerMetrics,
    }),
    historySettings,
  };
};

type StripeCheckoutSessionInput = Parameters<typeof mapStripeCheckoutSessionSummary>[0];

interface StripeCheckoutHistoryClient {
  checkout: {
    sessions: {
      list: (params: {
        created: { gte: number };
        limit: number;
        starting_after?: string;
      }) => Promise<{
        data: StripeCheckoutSessionInput[];
        has_more: boolean;
      }>;
    };
  };
}

export const listStripeCheckoutHistory = async ({
  stripe,
  createdGte,
  limit,
}: {
  stripe: StripeCheckoutHistoryClient;
  createdGte: number;
  limit: number;
}): Promise<StripeCheckoutSessionInput[]> => {
  const cappedLimit = normalizeBillingHistoryLimit(limit);
  const sessions: StripeCheckoutSessionInput[] = [];
  let startingAfter: string | undefined;

  while (sessions.length < cappedLimit) {
    const pageLimit = Math.min(100, cappedLimit - sessions.length);
    const page = await stripe.checkout.sessions.list({
      created: { gte: createdGte },
      limit: pageLimit,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    sessions.push(...page.data.slice(0, pageLimit));
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) break;
  }

  return sessions;
};

type StripeSubscriptionInput = Parameters<typeof mapStripeSubscriptionSummary>[0];

interface StripeSubscriptionListClient {
  subscriptions: {
    list: (params: {
      status: 'all';
      limit: 100;
      expand: ['data.customer'];
      starting_after?: string;
    }) => Promise<{
      data: StripeSubscriptionInput[];
      has_more: boolean;
    }>;
  };
}

export const listStripeSubscriptions = async ({
  stripe,
}: {
  stripe: StripeSubscriptionListClient;
}): Promise<StripeSubscriptionInput[]> => {
  const subscriptions: StripeSubscriptionInput[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    subscriptions.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) break;
  }

  return subscriptions;
};

type StripeRefundInput = Parameters<typeof mapStripeRefundSummary>[0];

export const listStripeRefunds = async ({
  stripe,
  createdGte,
}: {
  stripe: {
    refunds: {
      list: (params: { created: { gte: number }; limit: 100 }) => Promise<{ data: StripeRefundInput[] }>;
    };
  };
  createdGte: number;
}): Promise<StripeRefundInput[]> => {
  const page = await stripe.refunds.list({ created: { gte: createdGte }, limit: 100 });
  return page.data;
};
