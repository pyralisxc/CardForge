import type { OwnerSubscriptionSummary } from '@/features/owner/lib/ownerBillingOperations';

export const DEFAULT_OWNER_BILLING_TAB = 'subscribers' as const;

const subscriptionStatusPriority: Record<string, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  unpaid: 3,
  incomplete: 4,
  paused: 5,
  incomplete_expired: 8,
  canceled: 9,
};

export const sortOwnerSubscriptions = <Subscription extends {
  id: string;
  status: string | null;
}>(subscriptions: Subscription[]): Subscription[] => [...subscriptions].sort((left, right) => {
  const priorityDifference = (subscriptionStatusPriority[left.status ?? ''] ?? 6)
    - (subscriptionStatusPriority[right.status ?? ''] ?? 6);
  return priorityDifference || left.id.localeCompare(right.id);
});

export const getOwnerSubscriptionConnectionLabel = ({
  mappingStatus,
}: Pick<OwnerSubscriptionSummary, 'mappingStatus'>): string => {
  if (mappingStatus === 'connected') return 'Connected to production account';
  if (mappingStatus === 'stale') return 'Needs customer sign-in or reconciliation';
  if (mappingStatus === 'missing') return 'No production account connected';
  return 'Connection not verified';
};
