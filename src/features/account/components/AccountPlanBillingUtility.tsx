"use client";

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AccountEntitlement } from '@/features/account/lib/accountEntitlement';
import {
  buildAccountPlanManagementProjection,
  type AccountEntitlementState,
  type BillingPlatformState,
} from '@/features/account/lib/accountPlanManagement';
import type { McpAllowance } from '@/features/mcp-usage/client/plans';
import { AccountCheckoutStatusNotice, AccountPlanManagementPanel } from './AccountPlanManagementPanel';

interface PlatformStatusPayload {
  billing: {
    designerPassConfigured: boolean;
    productAccessConfigured: boolean;
  };
}

type BillingEntitlement = Pick<AccountEntitlement,
  | 'authConfigured'
  | 'canExportClean'
  | 'capabilities'
  | 'hasStripeCustomer'
  | 'isSignedIn'
  | 'paidPlan'
>;

export function AccountPlanBillingUtility({
  checkoutStatus = null,
  effectiveSignedIn,
  entitlement,
  entitlementState,
  initialPlanIntent = null,
  isDeveloper,
  isOwner,
  onRetryEntitlement,
  planLabel,
  plans,
}: {
  checkoutStatus?: 'cancelled' | 'success' | null;
  effectiveSignedIn?: boolean;
  entitlement: BillingEntitlement;
  entitlementState: AccountEntitlementState;
  initialPlanIntent?: 'creator' | 'designer' | null;
  isDeveloper: boolean;
  isOwner: boolean;
  onRetryEntitlement?: () => void;
  planLabel: string;
  plans: McpAllowance[];
}) {
  const [platformStatus, setPlatformStatus] = useState<PlatformStatusPayload | null>(null);
  const [platformState, setPlatformState] = useState<BillingPlatformState>('loading');
  const signedIn = effectiveSignedIn ?? entitlement.isSignedIn;

  useEffect(() => {
    if (!entitlement.authConfigured || entitlementState !== 'ready') return;
    let isMounted = true;
    setPlatformState('loading');
    void fetch('/api/billing/status', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load billing availability.');
        return response.json() as Promise<PlatformStatusPayload>;
      })
      .then((payload) => {
        if (!isMounted) return;
        setPlatformStatus(payload);
        setPlatformState('ready');
      })
      .catch(() => {
        if (!isMounted) return;
        setPlatformStatus(null);
        setPlatformState('unavailable');
      });
    return () => { isMounted = false; };
  }, [entitlement.authConfigured, entitlementState]);

  const projection = buildAccountPlanManagementProjection({
    authConfigured: entitlement.authConfigured,
    billingPlatformState: platformState,
    canExportClean: entitlement.canExportClean,
    entitlementState,
    hasStripeCustomer: entitlement.hasStripeCustomer,
    isDeveloper,
    isOwner,
    isSignedIn: signedIn,
    paidPlan: entitlement.paidPlan,
    productAccessConfigured: Boolean(platformStatus?.billing.productAccessConfigured),
    designerPassConfigured: Boolean(platformStatus?.billing.designerPassConfigured),
  });

  if (projection.surfaceState !== 'ready') {
    const copy = projection.surfaceState === 'authentication-unconfigured'
      ? {
          title: 'Authentication setup is required',
          message: 'CardForge cannot open account billing until the Clerk account boundary is configured.',
        }
      : projection.surfaceState === 'unavailable'
        ? {
            title: 'Account access is unavailable',
            message: 'Billing actions are withheld until CardForge can verify this account. This state has not been relabeled as Free.',
          }
        : {
            title: 'Checking account access',
            message: 'CardForge is verifying the account before presenting plan or billing actions.',
          };
    return (
      <>
        <AccountCheckoutStatusNotice checkoutStatus={checkoutStatus} />
        <div role="status" className="border-y border-[var(--cf-border-strong)] px-1 py-5">
          <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">{copy.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">{copy.message}</p>
          {projection.surfaceState === 'unavailable' && onRetryEntitlement ? (
            <Button type="button" variant="outline" className="mt-4" onClick={onRetryEntitlement}>Retry account access</Button>
          ) : null}
        </div>
      </>
    );
  }

  const cloudSetLimit = entitlement.capabilities.cloudSetLimit;
  const cloudSlotLabel = `${cloudSetLimit} private cloud set slot${cloudSetLimit === 1 ? '' : 's'}`;
  const downloadLabel = entitlement.canExportClean
    ? 'Watermark-free downloads'
    : 'Free exports include the CardForge watermark';

  return (
    <>
      {platformState === 'unavailable' ? (
        <div role="status" className="mb-4 border border-[var(--cf-warning-border)] bg-[var(--cf-surface-raised)] px-4 py-3 text-sm leading-6 text-[var(--cf-warning)]">
          Stripe checkout availability could not be verified. Existing Stripe billing access remains available when connected; new checkout actions are withheld for now.
        </div>
      ) : null}
      <AccountPlanManagementPanel
        authConfigured={entitlement.authConfigured}
        canExportClean={entitlement.canExportClean}
        canManageBilling={projection.canManageBilling}
        checkoutStatus={checkoutStatus}
        cloudSlotLabel={cloudSlotLabel}
        currentPlanKey={projection.currentPlanKey}
        downloadLabel={downloadLabel}
        effectiveSignedIn={signedIn}
        initialPlanIntent={initialPlanIntent}
        planLabel={planLabel}
        plans={plans}
        showCheckout={projection.showCheckout}
        showDesignerCheckout={projection.showDesignerCheckout}
      />
    </>
  );
}
