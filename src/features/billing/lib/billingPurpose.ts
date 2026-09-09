import {
  normalizeSupportMonthlyAmountCents,
  normalizeSupportOneTimeAmountCents,
  shouldGrantAccessForStripeSubscriptionStatus,
  shouldRevokeAccessForStripeSubscriptionStatus,
  type CreatorSupportOffering,
  type SupportMonthlyAmountCents,
} from './billing';

export type BillingPurpose = 'product_access' | 'creator_support';
export type BillingOffering = 'creator_pass' | 'designer_pass' | CreatorSupportOffering;
export type ClassifiedBillingPurpose = BillingPurpose | 'unmatched';

export interface BillingPriceConfiguration {
  creatorPassPriceId?: string | null;
  designerPassPriceId?: string | null;
  supportCurrency?: string | null;
  supportMonthlyPriceIds?: Partial<Record<SupportMonthlyAmountCents, string | null>>;
}

export interface BillingPurposeClassification {
  accepted: boolean;
  purpose: ClassifiedBillingPurpose;
  offering: BillingOffering | null;
  reason: string | null;
}

export interface BillingSubscriptionSnapshot {
  id: string;
  status?: string | null;
  metadata?: Record<string, string | null> | null;
  items?: {
    data?: Array<{
      price?: { currency?: string | null; id?: string; unit_amount?: number | null } | null;
    }>;
  };
}

export type ProductEntitlementResolution =
  | { action: 'paid'; subscription: BillingSubscriptionSnapshot }
  | { action: 'free'; subscription: BillingSubscriptionSnapshot }
  | { action: 'unchanged'; subscription: null };

export const canBillingPurposeUpdateProductEntitlement = (
  purpose: ClassifiedBillingPurpose,
): purpose is 'product_access' => purpose === 'product_access';

const reject = (reason: string): BillingPurposeClassification => ({
  accepted: false,
  purpose: 'unmatched',
  offering: null,
  reason,
});

export const classifyBillingPurpose = ({
  metadata,
  mode,
  priceIds,
  amountCents,
  currency,
  prices,
}: {
  metadata?: Record<string, string | null> | null;
  mode: string | null;
  priceIds: string[];
  amountCents?: number | null;
  currency?: string | null;
  prices: BillingPriceConfiguration;
}): BillingPurposeClassification => {
  if (priceIds.length !== 1) return reject('Expected exactly one configured Stripe price.');

  const purpose = metadata?.billingPurpose;
  const offering = metadata?.billingOffering;
  const priceId = priceIds[0];

  if (
    purpose === 'product_access'
    && (offering === 'creator_pass' || offering === 'designer_pass')
    && mode === 'subscription'
  ) {
    const priceOffering = priceId === prices.creatorPassPriceId
      ? 'creator_pass'
      : priceId === prices.designerPassPriceId
        ? 'designer_pass'
        : null;
    if (priceOffering) {
      return { accepted: true, purpose, offering: priceOffering, reason: null };
    }
  }

  if (
    purpose === 'creator_support'
    && offering === 'support_one_time'
    && mode === 'payment'
    && normalizeSupportOneTimeAmountCents(amountCents) !== null
    && currency?.toLowerCase() === prices.supportCurrency?.toLowerCase()
  ) {
    return { accepted: true, purpose, offering, reason: null };
  }

  const supportTierAmountCents = normalizeSupportMonthlyAmountCents(metadata?.supportTierAmountCents);
  if (
    purpose === 'creator_support'
    && offering === 'support_monthly'
    && mode === 'subscription'
    && supportTierAmountCents !== null
    && amountCents === supportTierAmountCents
    && currency?.toLowerCase() === prices.supportCurrency?.toLowerCase()
    && priceId === prices.supportMonthlyPriceIds?.[supportTierAmountCents]
  ) {
    return { accepted: true, purpose, offering, reason: null };
  }

  return reject('Billing metadata, mode, or price does not match server configuration.');
};

export const classifySubscriptionBillingPurpose = ({
  subscription,
  prices,
}: {
  subscription: {
    metadata?: Record<string, string | null> | null;
    items?: {
      data?: Array<{
        price?: { currency?: string | null; id?: string; unit_amount?: number | null } | null;
      }>;
    };
  };
  prices: BillingPriceConfiguration;
}): BillingPurposeClassification => classifyBillingPurpose({
  metadata: subscription.metadata,
  mode: 'subscription',
  priceIds: (subscription.items?.data ?? [])
    .map((item) => item.price?.id)
    .filter((priceId): priceId is string => Boolean(priceId)),
  amountCents: subscription.items?.data?.[0]?.price?.unit_amount,
  currency: subscription.items?.data?.[0]?.price?.currency,
  prices,
});

export const resolveCurrentProductEntitlement = ({
  current,
  customerSubscriptions,
  prices,
}: {
  current: BillingSubscriptionSnapshot;
  customerSubscriptions: BillingSubscriptionSnapshot[];
  prices: BillingPriceConfiguration;
}): ProductEntitlementResolution => {
  const currentClassification = classifySubscriptionBillingPurpose({ subscription: current, prices });
  const clerkUserId = current.metadata?.clerkUserId ?? null;
  if (currentClassification.purpose !== 'product_access' || !clerkUserId) {
    return { action: 'unchanged', subscription: null };
  }
  // Resolve the account, not the arrival order of subscription events. Designer
  // wins over Creator; stable IDs settle equal plans without metadata churn.
  const candidates = new Map(customerSubscriptions.map((candidate) => [candidate.id, candidate]));
  candidates.set(current.id, current);
  const active = [...candidates.values()].filter((candidate) => (
    candidate.metadata?.clerkUserId === clerkUserId
    && shouldGrantAccessForStripeSubscriptionStatus(candidate.status)
    && classifySubscriptionBillingPurpose({ subscription: candidate, prices }).purpose === 'product_access'
  )).sort((a, b) => {
    const rank = (candidate: BillingSubscriptionSnapshot) => (
      classifySubscriptionBillingPurpose({ subscription: candidate, prices }).offering === 'designer_pass' ? 2 : 1
    );
    return rank(b) - rank(a) || a.id.localeCompare(b.id);
  });
  if (active[0]) return { action: 'paid', subscription: active[0] };
  return shouldRevokeAccessForStripeSubscriptionStatus(current.status)
    ? { action: 'free', subscription: current }
    : { action: 'unchanged', subscription: null };
};
