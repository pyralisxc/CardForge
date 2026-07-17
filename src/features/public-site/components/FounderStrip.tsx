import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FounderStrip() {
  return (
    <section aria-labelledby="founder-heading" className="bg-[#f0e5d2] px-5 py-12 md:px-8 md:py-16">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div className="flex items-center gap-5" aria-hidden="true">
          <div className="grid h-24 w-20 place-items-center rounded-[var(--public-radius)] border border-[#9f8a69] bg-[var(--public-charcoal)]">
            <span className="font-[var(--public-font-display)] text-3xl text-[var(--public-brass)]">CL</span>
          </div>
          <div className="h-px flex-1 bg-[#a48f6d]" />
        </div>
        <div>
          <p className="text-base font-semibold uppercase tracking-[0.14em] text-[#76551c]">Human-built software</p>
          <h2 id="founder-heading" className="mt-3 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)] md:text-5xl">
            Built independently by Cameron Locke
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#5f5548]">
            CardForge grew from the need to produce complete, consistent card systems without rebuilding every card by hand. Cameron operates the product as an Oregon sole proprietor.
          </p>
          <div className="mt-6 flex flex-wrap gap-5">
            <Link href="/cameron" prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-base font-bold text-[#654817] hover:text-[var(--public-text)]">
              About Cameron <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/support" prefetch={false} className="inline-flex min-h-11 items-center text-base font-semibold text-[#654817] hover:text-[var(--public-text)]">
              Support the work
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
