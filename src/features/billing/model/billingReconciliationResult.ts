export interface BillingReconciliationResult {
  checked: number;
  repaired: number;
  unchanged: number;
  missingClerkUser: number;
  mappingRepaired: number;
  needsCustomerSignIn: number;
  ambiguousClerkUsers: number;
  ledgerCreated: number;
  missingLedger: number;
  hasMore: boolean;
}

export const buildBillingReconciliationDescription = (
  result: BillingReconciliationResult,
): string => {
  const subscriptionLabel = result.checked === 1 ? 'subscription' : 'subscriptions';
  const baselineLabel = result.ledgerCreated === 1 ? 'baseline' : 'baselines';
  const signInAction = result.needsCustomerSignIn > 0
    ? ' Ask the customer to sign in or register with their Stripe email; they should not purchase again.'
    : '';
  const ambiguousAction = result.ambiguousClerkUsers > 0
    ? ' Multiple production accounts matched at least one Stripe email; no mapping was guessed.'
    : '';
  return `${result.checked} ${subscriptionLabel} checked; ${result.ledgerCreated} ledger ${baselineLabel} created; ${result.repaired} entitlements repaired; ${result.mappingRepaired} account mappings repaired; ${result.unchanged} unchanged; ${result.missingClerkUser} missing Clerk users; ${result.missingLedger} subscriptions missing ledger coverage.${signInAction}${ambiguousAction}${result.hasMore ? ' Additional Stripe pages remain; run reconciliation again.' : ''}`;
};
