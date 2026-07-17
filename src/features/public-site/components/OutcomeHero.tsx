import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { LiveExampleGallery } from './LiveExampleGallery';

export function OutcomeHero() {
  return (
    <section className="bg-[var(--public-ivory)] px-5 py-14 md:px-8 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(32rem,1.08fr)] lg:items-center">
        <div>
          <p className="text-base font-semibold uppercase tracking-[0.14em] text-[#76551c]">
            Reusable card production
          </p>
          <h1 className="mt-4 max-w-3xl font-[var(--public-font-display)] text-4xl font-semibold leading-[1.06] text-[var(--public-text)] md:text-6xl">
            Build complete card sets from one reusable system.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f5548]">
            Design the template, connect your data, review the full set, and export production-ready files—all from a local-first workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/studio"
              prefetch={false}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-charcoal)] px-6 text-base font-bold text-[var(--public-ivory)] shadow-[var(--public-shadow)] hover:bg-[#2b2721]"
            >
              Try the Studio <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/examples"
              prefetch={false}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--public-radius)] border border-[#8d7e68] bg-white px-6 text-base font-bold text-[var(--public-text)] hover:border-[#775817]"
            >
              See Complete Sets
            </Link>
          </div>
        </div>

        <div aria-label="Live CardForge-rendered set proof">
          <LiveExampleGallery variant="hero" />
        </div>
      </div>
    </section>
  );
}
