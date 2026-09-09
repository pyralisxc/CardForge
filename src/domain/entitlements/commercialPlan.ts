export type CommercialPlan = 'free' | 'creator' | 'designer';

const normalizeCommercialPlan = (value: unknown): CommercialPlan | null =>
  value === 'free' || value === 'creator' || value === 'designer' ? value : null;

// Older grants shared the Stripe projection field. Preserve ambiguous access
// until an owner confirms the grant instead of guessing from the effective tier.
export const readOwnerCommercialPlan = (metadata: Record<string, unknown>): CommercialPlan | null => {
  const explicit = normalizeCommercialPlan(metadata.cardforgeOwnerCommercialPlan);
  if (explicit) return explicit;
  const stripeBound = typeof metadata.cardforgeStripeSubscriptionId === 'string' && Boolean(metadata.cardforgeStripeSubscriptionId);
  if (typeof metadata.cardforgeOwnerUpdatedAt !== 'string') {
    const effectivePlan = normalizeCommercialPlan(metadata.cardforgeCommercialPlan);
    return !stripeBound && (metadata.cardforgeAccess === 'paid' || effectivePlan === 'creator' || effectivePlan === 'designer')
      ? null : 'free';
  }
  if (stripeBound) return null;
  return normalizeCommercialPlan(metadata.cardforgeCommercialPlan) ?? 'free';
};

export const strongestCommercialPlan = (
  left: CommercialPlan,
  right: CommercialPlan,
): CommercialPlan => left === 'designer' || right === 'designer'
  ? 'designer' : left === 'creator' || right === 'creator' ? 'creator' : 'free';
