import { getBillingConfigStatus, type BillingConfigStatus } from '@/features/billing/lib/billing';

type StripeObjectRef = string | { id?: string } | null | undefined;

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
}

export interface OwnerSubscriptionSummary {
  id: string;
  customerId: string | null;
  clerkUserId: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
  amountCents: number | null;
  currency: string | null;
  interval: string | null;
}

export interface OwnerBillingSnapshot {
  status: BillingConfigStatus;
  recentCheckoutSessions: OwnerCheckoutSessionSummary[];
  recentSubscriptions: OwnerSubscriptionSummary[];
}

const getObjectId = (value: StripeObjectRef): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return typeof value.id === 'string' ? value.id : null;
};

const toIsoFromSeconds = (value: unknown): string | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;

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
      price?: {
        id?: string;
        unit_amount?: number | null;
        currency?: string | null;
        recurring?: { interval?: string | null } | null;
      } | null;
    }>;
  };
}): OwnerSubscriptionSummary => {
  const price = subscription.items?.data?.[0]?.price ?? null;
  return {
    id: subscription.id,
    customerId: getObjectId(subscription.customer),
    clerkUserId: subscription.metadata?.clerkUserId ?? null,
    status: subscription.status ?? null,
    currentPeriodEnd: toIsoFromSeconds(subscription.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    priceId: price?.id ?? null,
    amountCents: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    interval: price?.recurring?.interval ?? null,
  };
};

export const buildOwnerBillingSnapshot = ({
  config = getBillingConfigStatus(),
  checkoutSessions,
  subscriptions,
}: {
  config?: BillingConfigStatus;
  checkoutSessions: Parameters<typeof mapStripeCheckoutSessionSummary>[0][];
  subscriptions: Parameters<typeof mapStripeSubscriptionSummary>[0][];
}): OwnerBillingSnapshot => ({
  status: config,
  recentCheckoutSessions: checkoutSessions.map(mapStripeCheckoutSessionSummary),
  recentSubscriptions: subscriptions.map(mapStripeSubscriptionSummary),
});
