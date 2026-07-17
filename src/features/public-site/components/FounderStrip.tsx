import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FounderStrip() {
  return (
    <section aria-labelledby="founder-heading" className="border-b border-[var(--public-border)] bg-[var(--public-surface)] px-5 py-10 md:px-8 md:py-12">
      <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[0.62fr_1.38fr] lg:items-center">
        <div className="flex items-center gap-5" aria-hidden="true">
          <div className="grid h-24 w-20 place-items-center rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-obsidian)] shadow-[0_0_30px_rgba(217,164,65,0.08)]">
            <span className="font-[var(--public-font-display)] text-3xl text-[var(--public-brass)]">CL</span>
          </div>
          <div className="h-px flex-1 bg-[var(--public-border)]" />
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--public-brass)]">A real person is building this</p>
          <h2 id="founder-heading" className="mt-2 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
            Built independently by Cameron Locke
          </h2>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            I’m building CardForge in Oregon with a lot of curiosity, modern tools, and the belief that making a whole deck should feel just as creative as making the first card.
          </p>
          <div className="mt-6 flex flex-wrap gap-5">
            <Link href="/cameron" prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-base font-bold text-[var(--public-brass)] hover:text-[var(--public-ivory)]">
              Come say hello <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/support" prefetch={false} className="inline-flex min-h-11 items-center text-base font-semibold text-[var(--public-muted-text)] hover:text-[var(--public-ivory)]">
              Support the work
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
