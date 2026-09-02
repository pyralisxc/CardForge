import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAccountPlanManagementProjection } from '@/features/account/lib/accountPlanManagement';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

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

  it('opens billing as a progressive Profile layer while preserving native Stripe and MCP owners', () => {
    const environment = readSource('src/app/account/_components/AccountProfileEnvironment.tsx');
    const utility = readSource('src/features/account/components/AccountPlanBillingUtility.tsx');
    const panel = readSource('src/features/account/components/AccountPlanManagementPanel.tsx');
    const actions = readSource('src/features/billing/components/AccountBillingActions.tsx');

    expect(environment).toContain("activeUtility === 'billing'");
    expect(environment).toContain('<AccountPlanBillingUtility');
    expect(environment).toContain("router.push('/account?section=profile&utility=billing')");
    expect(environment).toContain('id="account-and-billing"');
    expect(environment).toContain('checkoutStatus={checkoutStatus}');
    expect(environment).toContain('initialPlanIntent={initialPlanIntent}');
    expect(utility).toContain("fetch('/api/billing/status'");
    expect(utility).toContain('<AccountCheckoutStatusNotice checkoutStatus={checkoutStatus} />');
    expect(utility).toContain('<AccountPlanManagementPanel');
    expect(panel).toContain('<AccountMcpUsageSection');
    expect(actions).toContain("handleStartCheckout('creator_pass')");
    expect(actions).toContain("handleStartCheckout('designer_pass')");
    expect(actions).toContain('handleOpenBillingPortal');
  });
});
