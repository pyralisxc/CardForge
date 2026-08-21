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
    <div className="grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(16.5rem,82%)] gap-3 overflow-x-auto pb-3 lg:auto-cols-[minmax(17rem,42%)] xl:grid-flow-row xl:grid-cols-4 xl:auto-cols-auto xl:overflow-visible xl:pb-0">
      {plans.filter((plan) => plan.isVisible).map((plan) => {
        const isCurrent = currentPlanKey === plan.planKey;
        const href = plan.planKey === 'creator' && creatorHref
          ? creatorHref
          : plan.planKey === 'designer' && designerHref
            ? designerHref
            : defaultPlanHref(plan.planKey);
        const isFeatured = plan.planKey === featuredPlanKey;
        return (
          <article key={plan.planKey} className={`flex min-h-full snap-start flex-col border bg-[#15100a] p-5 ${isFeatured ? 'border-[#d8b365] shadow-[inset_0_3px_0_#d8b365]' : 'border-[#5f4526]'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-serif text-2xl font-semibold text-[#fff1c7]">{plan.displayName}</h3>
              {isCurrent ? <span className="border border-[#5f7f54] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#bde3a8]">Current</span> : null}
            </div>
            <div className="mt-5 min-h-[4.5rem] border-b border-[#3c2c1b] pb-5">
              <p className="font-serif text-4xl font-semibold leading-none text-[#fff1c7]">{plan.priceLabel}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a98a75]">{plan.priceNote}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#c7b288]">{plan.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-[#d8c49a]">
              {plan.featureSummary.split('\n').map((feature) => feature.trim()).filter(Boolean).map((feature) => (
                <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d8b365]" aria-hidden="true" /><span>{feature}</span></li>
              ))}
            </ul>
            <div className="mt-auto pt-5">
              {isCurrent ? (
                <span className="inline-flex min-h-11 w-full items-center justify-center border border-[#5f7f54] px-4 font-semibold text-[#bde3a8]">Your current plan</span>
              ) : (
                <Link href={href} prefetch={false} className={`inline-flex min-h-11 w-full items-center justify-center border px-4 text-center font-bold transition-colors ${isFeatured ? 'border-[#e4aa43] bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]' : 'border-[#846634] text-[#f8e3b0] hover:border-[#d9a441] hover:bg-[#24180e]'}`}>{plan.ctaLabel}</Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
