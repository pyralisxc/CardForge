import { describe, expect, it } from 'vitest';

import { buildBillingReconciliationDescription } from '@/features/billing/model/billingReconciliationResult';

describe('billing reconciliation result', () => {
  it('shows every live reconciliation proof in the owner notification', () => {
    expect(buildBillingReconciliationDescription({
      checked: 1,
      repaired: 0,
      unchanged: 1,
      missingClerkUser: 0,
      mappingRepaired: 0,
      needsCustomerSignIn: 0,
      ambiguousClerkUsers: 0,
      ledgerCreated: 1,
      missingLedger: 0,
      hasMore: false,
    })).toBe('1 subscription checked; 1 ledger baseline created; 0 entitlements repaired; 0 account mappings repaired; 1 unchanged; 0 missing Clerk users; 0 subscriptions missing ledger coverage.');
  });

  it('tells the owner how to recover a subscriber without charging them again', () => {
    expect(buildBillingReconciliationDescription({
      checked: 1,
      repaired: 0,
      unchanged: 0,
      missingClerkUser: 1,
      mappingRepaired: 0,
      needsCustomerSignIn: 1,
      ambiguousClerkUsers: 0,
      ledgerCreated: 0,
      missingLedger: 0,
      hasMore: false,
    })).toContain('Ask the customer to sign in or register with their Stripe email; they should not purchase again.');
  });
});
