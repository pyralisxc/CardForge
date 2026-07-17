import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { StudioProductProof } from './StudioProductProof';

export function OutcomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 md:px-8 md:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(173,102,30,0.19),transparent_38%),linear-gradient(115deg,rgba(217,164,65,0.06),transparent_36%)]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-9 lg:grid-cols-[minmax(0,0.82fr)_minmax(34rem,1.18fr)] lg:items-center">
        <div>
          <p className="text-base font-semibold text-[var(--public-brass)]">
            Build the card once. Let the set follow.
          </p>
          <h1 className="mt-4 max-w-3xl font-[var(--public-font-display)] text-4xl font-semibold leading-[1.05] text-[var(--public-ivory)] md:text-6xl">
            Design one card. Add your list. CardForge builds the set.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--public-muted-text)]">
            Make the look once, add the words and pictures for each card, and watch the whole set come together. Try it in your browser and keep your work on your device.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/studio"
              prefetch={false}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-brass)] px-6 text-base font-bold text-[var(--public-obsidian)] shadow-[var(--public-shadow)] hover:bg-[#f0bd58]"
            >
              Try the Studio <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/examples"
              prefetch={false}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] px-6 text-base font-bold text-[var(--public-ivory)] hover:border-[var(--public-brass)]"
            >
              See what it makes
            </Link>
          </div>
        </div>

        <div aria-label="CardForge Studio product proof">
          <StudioProductProof />
        </div>
      </div>
    </section>
  );
}
