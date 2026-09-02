"use client";

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useSiteContent } from './PublicSitePresentationContext';

const initialsFor = (name: string): string => name
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() ?? '')
  .join('') || 'CF';

export function FounderStrip({ founderName }: { founderName: string }) {
  const siteContent = useSiteContent();
  return (
    <section aria-labelledby="founder-heading" className="border-b border-[var(--public-border)] bg-[var(--public-surface)] px-5 py-10 md:px-8 md:py-12">
      <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[0.62fr_1.38fr] lg:items-center">
        <div className="flex items-center gap-5" aria-hidden="true">
          <div className="grid h-24 w-20 place-items-center rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-obsidian)] shadow-[0_0_30px_rgba(217,164,65,0.08)]">
            <span className="font-[var(--public-font-display)] text-3xl text-[var(--public-brass)]">{initialsFor(founderName)}</span>
          </div>
          <div className="h-px flex-1 bg-[var(--public-border)]" />
        </div>
        <div>
          <p data-site-content-slug="landing.founder.eyebrow" className="text-base font-semibold text-[var(--public-brass)]">{siteContent['landing.founder.eyebrow']}</p>
          <h2 data-site-content-slug="landing.founder.headline" id="founder-heading" className="mt-2 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
            {siteContent['landing.founder.headline']}
          </h2>
          <p data-site-content-slug="landing.founder.body" className="mt-3 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            {siteContent['landing.founder.body']}
          </p>
          <div className="mt-6">
            <Link href="/cameron" prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-base font-bold text-[var(--public-brass)] hover:text-[var(--public-ivory)]">
              {siteContent['landing.founder.action']} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
