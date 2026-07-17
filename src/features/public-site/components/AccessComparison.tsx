import Link from 'next/link';

const accessOptions = [
  ['Try it free', 'Open the Studio, make cards, and see how your set comes together.'],
  ['Founder Beta', 'Early access for people helping shape CardForge while the current wave has room.'],
  ['Creator Pass', 'Subscribe when you want clean downloads and want to support the CardForge business.'],
  ['Build with us', 'A separate path for developers who want to improve shared CardForge tools and artwork.'],
] as const;

export function AccessComparison() {
  return (
    <section aria-labelledby="access-heading" className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 text-[var(--public-ivory)] md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--public-brass)]">Start where you are</p>
            <h2 id="access-heading" className="mt-2 max-w-3xl font-[var(--public-font-display)] text-3xl font-semibold md:text-4xl">
              Try CardForge first. Subscribe when it earns a place in your work.
            </h2>
          </div>
          <Link href="/access" prefetch={false} className="inline-flex min-h-11 items-center text-base font-bold text-[var(--public-brass)] hover:text-[#f2d697]">
            Compare access details
          </Link>
        </div>
        <div className="mt-7 grid gap-px overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-border)] sm:grid-cols-2 xl:grid-cols-4">
          {accessOptions.map(([title, copy]) => (
            <article key={title} className="bg-[var(--public-surface)] p-5">
              <h3 className="font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{title}</h3>
              <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
