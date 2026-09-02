"use client";

import Link from 'next/link';
import { ArrowRight, CreditCard, UserPlus, Wrench } from 'lucide-react';

import { PlanChoiceGrid, type McpAllowance } from '@/features/mcp-usage/client/plans';
import { useSiteContent } from './PublicSitePresentationContext';

export function PlansPageContent({ plans }: { plans: McpAllowance[] }) {
  const siteContent = useSiteContent();
  const steps = [
    {
      icon: <UserPlus className="h-5 w-5" aria-hidden="true" />,
      title: siteContent['plans.process.account.title'],
      body: siteContent['plans.process.account.body'],
    },
    {
      icon: <CreditCard className="h-5 w-5" aria-hidden="true" />,
      title: siteContent['plans.process.subscribe.title'],
      body: siteContent['plans.process.subscribe.body'],
    },
    {
      icon: <Wrench className="h-5 w-5" aria-hidden="true" />,
      title: siteContent['plans.process.manage.title'],
      body: siteContent['plans.process.manage.body'],
    },
  ];

  return (
    <>
      <section className="border-b border-[var(--public-border)] bg-[radial-gradient(circle_at_top_left,#352310_0%,var(--cf-canvas)_58%)] px-5 py-12 text-[var(--public-ivory)] md:px-8 md:py-16">
        <div className="mx-auto max-w-7xl">
          <p data-site-content-slug="plans.hero.eyebrow" className="text-base font-semibold text-[var(--public-brass)]">{siteContent['plans.hero.eyebrow']}</p>
          <h1 data-site-content-slug="plans.hero.headline" className="mt-3 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight md:text-6xl">
            {siteContent['plans.hero.headline']}
          </h1>
          <p data-site-content-slug="plans.hero.body" className="mt-5 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            {siteContent['plans.hero.body']}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/account?section=profile&utility=billing#account-and-billing" prefetch={false} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-brass)] px-5 font-bold text-[var(--public-obsidian)] hover:bg-[#f0bd58]">
              View your plan <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/account" prefetch={false} className="inline-flex min-h-11 items-center justify-center border border-[var(--public-border)] px-5 font-bold text-[var(--public-ivory)] hover:border-[var(--public-brass)]">
              Open Desk free
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="plans-comparison-heading" className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-11 text-[var(--public-ivory)] md:px-8 md:py-14">
        <div className="mx-auto max-w-7xl">
          <h2 data-site-content-slug="plans.compare.heading" id="plans-comparison-heading" className="font-[var(--public-font-display)] text-3xl font-semibold md:text-4xl">{siteContent['plans.compare.heading']}</h2>
          <p data-site-content-slug="plans.compare.body" className="mt-3 mb-7 max-w-3xl text-base leading-7 text-[var(--public-muted-text)]">{siteContent['plans.compare.body']}</p>
          <PlanChoiceGrid plans={plans} />
          <p data-site-content-slug="plans.beta.note" className="mt-5 max-w-4xl border-l-2 border-[var(--public-brass)] pl-4 text-sm leading-6 text-[var(--public-muted-text)]">{siteContent['plans.beta.note']}</p>
        </div>
      </section>

      <section aria-labelledby="subscription-process-heading" className="bg-[var(--public-surface)] px-5 py-11 text-[var(--public-ivory)] md:px-8 md:py-14">
        <div className="mx-auto max-w-7xl">
          <h2 data-site-content-slug="plans.process.heading" id="subscription-process-heading" className="font-[var(--public-font-display)] text-3xl font-semibold md:text-4xl">{siteContent['plans.process.heading']}</h2>
          <ol className="mt-7 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="border border-[var(--public-border)] bg-[var(--public-obsidian)] p-5">
                <div className="flex items-center gap-3 text-[var(--public-brass)]">
                  {step.icon}
                  <span className="text-sm font-bold uppercase tracking-[0.14em]">Step {index + 1}</span>
                </div>
                <h3 className="mt-4 font-[var(--public-font-display)] text-2xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
