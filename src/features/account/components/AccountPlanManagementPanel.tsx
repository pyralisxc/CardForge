"use client";

import Link from 'next/link';
import { CheckCircle2, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { markSignUpIntent } from '@/features/analytics/client/tracking';
import { AccountBillingActions } from '@/features/billing/client/account';
import { AccountMcpUsageSection } from '@/features/mcp-usage/client/account';
import { PlanChoiceGrid, type McpAllowance, type McpUsagePlanKey } from '@/features/mcp-usage/client/plans';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

export function AccountPlanManagementPanel({
  authConfigured,
  canExportClean,
  canManageBilling,
  checkoutStatus,
  cloudSlotLabel,
  currentPlanKey,
  downloadLabel,
  effectiveSignedIn,
  initialPlanIntent,
  planLabel,
  plans,
  showCheckout,
  showDesignerCheckout,
}: {
  authConfigured: boolean;
  canExportClean: boolean;
  canManageBilling: boolean;
  checkoutStatus: 'cancelled' | 'success' | null;
  cloudSlotLabel: string;
  currentPlanKey?: McpUsagePlanKey;
  downloadLabel: string;
  effectiveSignedIn: boolean;
  initialPlanIntent: 'creator' | 'designer' | null;
  planLabel: string;
  plans: McpAllowance[];
  showCheckout: boolean;
  showDesignerCheckout: boolean;
}) {
  const intendedPlanLabel = initialPlanIntent === 'designer'
    ? plans.find((plan) => plan.planKey === 'designer')?.displayName ?? 'Designer Pass'
    : initialPlanIntent === 'creator'
      ? plans.find((plan) => plan.planKey === 'creator')?.displayName ?? 'Creator Pass'
      : null;
  const accountSignUpReturnPath = initialPlanIntent
    ? `/account?intent=${initialPlanIntent}#account-and-billing`
    : '/account#account-and-billing';
  const creatorHref = effectiveSignedIn
    ? '#account-actions'
    : createAuthRouteHref('/sign-up', '/account?intent=creator#account-and-billing');
  const designerHref = effectiveSignedIn
    ? '#account-actions'
    : createAuthRouteHref('/sign-up', '/account?intent=designer#account-and-billing');

  return (
    <>
      {checkoutStatus ? (
        <div role="status" className={`mb-4 border px-4 py-3 text-sm leading-6 ${checkoutStatus === 'success' ? 'border-[var(--cf-success-border)] bg-[var(--cf-surface-raised)] text-[var(--cf-success)]' : 'border-[var(--cf-warning-border)] bg-[var(--cf-surface-raised)] text-[var(--cf-warning)]'}`}>
          {checkoutStatus === 'success'
            ? 'Checkout is complete. CardForge is confirming the subscription and refreshing the access shown on this account.'
            : 'Checkout was closed before payment. No subscription change was made, and you can review the plans again below.'}
        </div>
      ) : null}

      <div className="border-y border-[var(--cf-border-strong)] py-4 md:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em]">Current access</span>
            </div>
            <h3 className="mt-3 font-serif text-2xl text-[var(--cf-text-strong)]">{planLabel}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
              {canManageBilling
                ? 'Your subscription is connected. Open Stripe billing whenever you want to change the plan or payment details.'
                : canExportClean
                  ? 'Paid access is active for this account. Your included limits and capabilities are shown below.'
                  : effectiveSignedIn
                    ? intendedPlanLabel
                      ? `You selected ${intendedPlanLabel}. Confirm the choice below, then continue through secure Stripe Checkout.`
                      : 'You are on Free. Compare Creator and Designer below before starting a subscription.'
                    : 'Free Studio access needs no account. Create one when you want private cloud saves, ChatGPT plugin access, or a paid plan.'}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--cf-text-subtle)]">{cloudSlotLabel}. {downloadLabel}.</p>
          </div>
          <div id="account-actions" className="scroll-mt-24">
            {intendedPlanLabel && !canExportClean ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Selected: {intendedPlanLabel}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <AccountBillingActions
                authConfigured={authConfigured}
                canManageBilling={canManageBilling}
                effectiveSignedIn={effectiveSignedIn}
                checkoutLabel="Choose Creator"
                showDesignerCheckout={showDesignerCheckout}
                showCheckout={showCheckout}
              />
              {!effectiveSignedIn && authConfigured ? (
                <>
                  <Button asChild size="lg" variant="outline" className="border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                    <Link href={createAuthRouteHref('/sign-in', accountSignUpReturnPath)} prefetch={false}>Sign in</Link>
                  </Button>
                  <Button asChild size="lg" className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110" onClick={markSignUpIntent}>
                    <Link href={createAuthRouteHref('/sign-up', accountSignUpReturnPath)} prefetch={false}>Create account</Link>
                  </Button>
                </>
              ) : null}
              {effectiveSignedIn && !canManageBilling && !showCheckout && canExportClean ? (
                <div className="inline-flex min-h-11 items-center gap-2 border border-[var(--cf-success-border)] px-3 text-sm font-semibold text-[var(--cf-success)]">
                  <CheckCircle2 className="h-4 w-4" /> Access active
                </div>
              ) : null}
              <Button asChild size="lg" variant="ghost" className="text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                <Link href="/plans" prefetch={false}>Open plans page</Link>
              </Button>
            </div>
          </div>
        </div>

        <details className="group mt-5 border-t border-[var(--cf-border-subtle)] pt-1" open={Boolean(initialPlanIntent) && !canExportClean}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-sm font-semibold text-[var(--cf-text-strong)]">Compare available plans</span>
              <span className="mt-0.5 block text-xs text-[var(--cf-text-muted)]">Prices, Studio benefits, ChatGPT capacity, and private workspace retention</span>
            </span>
            <span className="text-lg text-[var(--cf-accent-strong)] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <div className="pb-5 pt-2">
            <PlanChoiceGrid
              plans={plans}
              currentPlanKey={currentPlanKey}
              creatorHref={creatorHref}
              designerHref={designerHref}
              featuredPlanKey={initialPlanIntent ?? 'creator'}
            />
          </div>
        </details>
      </div>

      {authConfigured && effectiveSignedIn ? (
        <details className="group border-b border-[var(--cf-border)]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-sm font-semibold text-[var(--cf-text-strong)]">CardForge for ChatGPT usage</span>
              <span className="mt-0.5 block text-xs text-[var(--cf-text-muted)]">Review current assisted-action observations and plan capacity targets</span>
            </span>
            <span className="text-lg text-[var(--cf-accent-strong)] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <div className="pb-4"><AccountMcpUsageSection /></div>
        </details>
      ) : null}
    </>
  );
}
