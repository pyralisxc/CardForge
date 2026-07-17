import {
  normalizeSupportMonthlyAmountCents,
  normalizeSupportOneTimeAmountCents,
  shouldGrantAccessForStripeSubscriptionStatus,
  shouldRevokeAccessForStripeSubscriptionStatus,
  type CreatorSupportOffering,
  type SupportMonthlyAmountCents,
} from './billing';

export type BillingPurpose = 'product_access' | 'creator_support';
export type BillingOffering = 'creator_pass' | CreatorSupportOffering;
export type ClassifiedBillingPurpose = BillingPurpose | 'unmatched';

export interface BillingPriceConfiguration {
  creatorPassPriceId?: string | null;
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
    && offering === 'creator_pass'
    && mode === 'subscription'
    && Boolean(prices.creatorPassPriceId)
    && priceId === prices.creatorPassPriceId
  ) {
    return { accepted: true, purpose, offering, reason: null };
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
  if (shouldGrantAccessForStripeSubscriptionStatus(current.status)) {
    return { action: 'paid', subscription: current };
  }
  if (!shouldRevokeAccessForStripeSubscriptionStatus(current.status)) {
    return { action: 'unchanged', subscription: null };
  }

  const replacement = customerSubscriptions.find((candidate) => (
    candidate.id !== current.id
    && candidate.metadata?.clerkUserId === clerkUserId
    && shouldGrantAccessForStripeSubscriptionStatus(candidate.status)
    && classifySubscriptionBillingPurpose({ subscription: candidate, prices }).purpose === 'product_access'
  ));

  return replacement
    ? { action: 'paid', subscription: replacement }
    : { action: 'free', subscription: current };
};
