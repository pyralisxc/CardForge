import type { PaidPlan } from '@/domain/entitlements';
import type { McpUsagePlanKey } from '@/features/mcp-usage/client/plans';

export type AccountEntitlementState = 'loading' | 'ready' | 'unavailable';
export type BillingPlatformState = 'loading' | 'ready' | 'unavailable';

export interface AccountPlanManagementProjection {
  canManageBilling: boolean;
  currentPlanKey?: McpUsagePlanKey;
  showCheckout: boolean;
  showDesignerCheckout: boolean;
  surfaceState: 'authentication-unconfigured' | AccountEntitlementState;
}

export function buildAccountPlanManagementProjection({
  authConfigured,
  billingPlatformState,
  canExportClean,
  entitlementState,
  hasStripeCustomer,
  isDeveloper,
  isOwner,
  isSignedIn,
  paidPlan,
  productAccessConfigured,
  designerPassConfigured,
}: {
  authConfigured: boolean;
  billingPlatformState: BillingPlatformState;
  canExportClean: boolean;
  entitlementState: AccountEntitlementState;
  hasStripeCustomer: boolean;
  isDeveloper: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
  paidPlan: PaidPlan | null;
  productAccessConfigured: boolean;
  designerPassConfigured: boolean;
}): AccountPlanManagementProjection {
  const surfaceState = !authConfigured ? 'authentication-unconfigured' : entitlementState;
  const entitlementReady = surfaceState === 'ready';
  const canStartCheckout = entitlementReady && isSignedIn && !canExportClean;

  return {
    canManageBilling: entitlementReady && isSignedIn && hasStripeCustomer,
    currentPlanKey: isOwner || isDeveloper
      ? undefined
      : paidPlan === 'designer'
        ? 'designer'
        : canExportClean
          ? 'creator'
          : 'free',
    showCheckout: canStartCheckout
      && billingPlatformState === 'ready'
      && productAccessConfigured,
    showDesignerCheckout: canStartCheckout
      && billingPlatformState === 'ready'
      && designerPassConfigured,
    surfaceState,
  };
}
