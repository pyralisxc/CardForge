import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function OutcomeHero() {
  return (
    <section className="relative flex min-h-[34rem] overflow-hidden border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-12 md:min-h-[40rem] md:px-8 md:py-16">
      <Image
        src="/card-assets/showcase/cardforge-workshop-cover.webp"
        alt="A warm CardForge workshop with illustrated card proofs, drawing tools, and a card-layout screen spread across a dark wood desk."
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-[62%_center]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,6,5,0.97)_0%,rgba(9,8,6,0.88)_30%,rgba(9,8,6,0.42)_58%,rgba(7,6,5,0.16)_100%),linear-gradient(0deg,rgba(7,6,5,0.82)_0%,transparent_45%)]" aria-hidden="true" />
      <div className="relative mx-auto flex w-full max-w-7xl items-center">
        <div className="max-w-3xl">
          <p className="text-base font-semibold text-[var(--public-brass)]">
            Build the card once. Let the set follow.
          </p>
          <h1 className="mt-4 font-[var(--public-font-display)] text-4xl font-semibold leading-[1.05] text-[var(--public-ivory)] drop-shadow-[0_3px_16px_rgba(0,0,0,0.75)] md:text-6xl">
            Design one card. Add your list. CardForge builds the set.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#ddd2c2] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
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
              href="#interactive-showcase"
              prefetch={false}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--public-radius)] border border-[#8b6631] bg-[rgba(18,14,10,0.82)] px-6 text-base font-bold text-[var(--public-ivory)] backdrop-blur-sm hover:border-[var(--public-brass)]"
            >
              See what it makes
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
