"use client";

import Link from 'next/link';

import { PlanChoiceGrid, type McpAllowance } from '@/features/mcp-usage/client/plans';
import { useSiteContent } from './PublicSitePresentationContext';

export function AccessComparison({ plans }: { plans: McpAllowance[] }) {
  const siteContent = useSiteContent();
  return (
    <section aria-labelledby="access-heading" className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 text-[var(--public-ivory)] md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--public-brass)]">{siteContent['landing.access.eyebrow']}</p>
            <h2 id="access-heading" className="mt-2 max-w-3xl font-[var(--public-font-display)] text-3xl font-semibold md:text-4xl">
              {siteContent['landing.access.headline']}
            </h2>
          </div>
          <Link href="/account" prefetch={false} className="inline-flex min-h-11 items-center text-base font-bold text-[var(--public-brass)] hover:text-[#f2d697]">
            Check your access
          </Link>
        </div>
        <div className="mt-7"><PlanChoiceGrid plans={plans} /></div>
        <p className="mt-4 text-sm leading-6 text-[var(--public-muted-text)]">
          {siteContent['landing.access.developer-note']}
        </p>
      </div>
    </section>
  );
}
