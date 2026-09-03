import { describe, expect, it } from 'vitest';

import { buildAccountPlanManagementProjection } from '@/features/account/lib/accountPlanManagement';

const readyFreeInput = {
  authConfigured: true,
  billingPlatformState: 'ready' as const,
  canExportClean: false,
  entitlementState: 'ready' as const,
  hasStripeCustomer: false,
  isContributor: false,
  isOwner: false,
  isSignedIn: true,
  paidPlan: null,
  productAccessConfigured: true,
  designerPassConfigured: true,
};

describe('account plan and billing utility', () => {
  it('offers only server-configured Stripe checkout choices to a verified Free account', () => {
    expect(buildAccountPlanManagementProjection(readyFreeInput)).toEqual({
      canManageBilling: false,
      currentPlanKey: 'free',
      showCheckout: true,
      showDesignerCheckout: true,
      surfaceState: 'ready',
    });
  });

  it('withholds financial actions when account access is unavailable instead of presenting Free', () => {
    expect(buildAccountPlanManagementProjection({
      ...readyFreeInput,
      entitlementState: 'unavailable',
    })).toMatchObject({
      canManageBilling: false,
      showCheckout: false,
      showDesignerCheckout: false,
      surfaceState: 'unavailable',
    });
  });

  it('keeps the Stripe portal available for a verified paid customer when checkout status is unavailable', () => {
    expect(buildAccountPlanManagementProjection({
      ...readyFreeInput,
      billingPlatformState: 'unavailable',
      canExportClean: true,
      hasStripeCustomer: true,
      paidPlan: 'designer',
    })).toEqual({
      canManageBilling: true,
      currentPlanKey: 'designer',
      showCheckout: false,
      showDesignerCheckout: false,
      surfaceState: 'ready',
    });
  });
});
