import { describe, expect, it } from 'vitest';

import {
  DEFAULT_OWNER_BILLING_TAB,
  getOwnerSubscriptionConnectionLabel,
  sortOwnerSubscriptions,
} from '@/features/owner/lib/ownerBillingPresentation';

describe('owner billing presentation', () => {
  it('opens on actual subscribers instead of checkout attempts', () => {
    expect(DEFAULT_OWNER_BILLING_TAB).toBe('subscribers');
  });

  it('orders active subscriptions before attention and ended states', () => {
    expect(sortOwnerSubscriptions([
      { id: 'sub_canceled', status: 'canceled' },
      { id: 'sub_active', status: 'active' },
      { id: 'sub_past_due', status: 'past_due' },
      { id: 'sub_trial', status: 'trialing' },
    ]).map(({ id }) => id)).toEqual([
      'sub_active',
      'sub_trial',
      'sub_past_due',
      'sub_canceled',
    ]);
  });

  it('uses support-oriented account connection labels', () => {
    expect(getOwnerSubscriptionConnectionLabel({ mappingStatus: 'connected' }))
      .toBe('Connected to production account');
    expect(getOwnerSubscriptionConnectionLabel({ mappingStatus: 'stale' }))
      .toBe('Needs customer sign-in or reconciliation');
    expect(getOwnerSubscriptionConnectionLabel({ mappingStatus: 'missing' }))
      .toBe('No production account connected');
    expect(getOwnerSubscriptionConnectionLabel({ mappingStatus: 'unverified' }))
      .toBe('Connection not verified');
  });
});
