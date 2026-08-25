import Link from 'next/link';
import { Check } from 'lucide-react';

import type { McpAllowance, McpUsagePlanKey } from '@/features/mcp-usage/lib/mcpUsage';

const defaultPlanHref = (planKey: McpUsagePlanKey): string => {
  if (planKey === 'free') return '/studio';
  if (planKey === 'creator') return '/sign-up?redirect_url=%2Faccount%3Fintent%3Dcreator%23account-and-billing';
  if (planKey === 'designer') return '/sign-up?redirect_url=%2Faccount%3Fintent%3Ddesigner%23account-and-billing';
  return '/contact?kind=business';
};

export function PlanChoiceGrid({
  plans,
  currentPlanKey,
  creatorHref,
  designerHref,
  featuredPlanKey = 'creator',
}: {
  plans: McpAllowance[];
  currentPlanKey?: McpUsagePlanKey;
  creatorHref?: string;
  designerHref?: string;
  featuredPlanKey?: McpUsagePlanKey;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {plans.filter((plan) => plan.isVisible).map((plan) => {
        const isCurrent = currentPlanKey === plan.planKey;
        const href = plan.planKey === 'creator' && creatorHref
          ? creatorHref
          : plan.planKey === 'designer' && designerHref
            ? designerHref
            : defaultPlanHref(plan.planKey);
        const isFeatured = plan.planKey === featuredPlanKey;
        const features = [
          ...plan.featureSummary.split('\n').map((feature) => feature.trim()).filter(Boolean),
          plan.planKey === 'enterprise'
            ? 'Assistant-draft retention tailored to your team'
            : `Assistant drafts stay active for ${plan.draftRetentionHours} hours`,
        ];
        return (
          <article key={plan.planKey} className={`flex min-h-full flex-col border bg-[var(--cf-surface)] p-4 sm:p-5 ${isFeatured ? 'border-[var(--cf-accent)]' : 'border-[var(--cf-border)]'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-serif text-2xl font-semibold text-[var(--cf-text-strong)]">{plan.displayName}</h3>
              {isCurrent ? <span className="border border-[var(--cf-success-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--cf-success)]">Current</span> : null}
            </div>
            <div className="mt-5 min-h-[4.5rem] border-b border-[var(--cf-border-subtle)] pb-5">
              <p className="font-serif text-4xl font-semibold leading-none text-[var(--cf-text-strong)]">{plan.priceLabel}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">{plan.priceNote}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">{plan.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--cf-text-muted)]">
              {features.map((feature) => (
                <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cf-accent)]" aria-hidden="true" /><span>{feature}</span></li>
              ))}
            </ul>
            <div className="mt-auto pt-5">
              {isCurrent ? (
                <span className="inline-flex min-h-11 w-full items-center justify-center border border-[var(--cf-success-border)] px-4 font-semibold text-[var(--cf-success)]">Your current plan</span>
              ) : (
                <Link href={href} prefetch={false} className={`inline-flex min-h-11 w-full items-center justify-center border px-4 text-center font-bold transition-colors ${isFeatured ? 'border-[var(--cf-accent-strong)] bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110' : 'border-[var(--cf-accent)] text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)]'}`}>{plan.ctaLabel}</Link>
              )}
            </div>
          </article>
        );
      })}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--cf-text-subtle)]">
        ChatGPT plugin action and private workspace figures are current beta capacity targets. CardForge measures them for planning; they are not enforced quotas or overage charges today.
      </p>
    </>
  );
}
