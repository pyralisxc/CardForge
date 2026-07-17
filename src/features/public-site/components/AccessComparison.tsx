import Link from 'next/link';

const accessOptions = [
  ['Explore Free', 'Open the Studio, build templates, import data, and preview your set locally.'],
  ['Founder Beta', 'Active beta seats provide early production access while the current wave has room.'],
  ['Creator Pass', 'The product subscription for clean exports and the expanding reviewed library.'],
  ['Developer', 'A separate contributor path for people improving reviewed shared assets.'],
] as const;

export function AccessComparison() {
  return (
    <section aria-labelledby="access-heading" className="bg-[var(--public-charcoal)] px-5 py-12 text-[var(--public-ivory)] md:px-8 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-semibold uppercase tracking-[0.14em] text-[var(--public-brass)]">Access without ambiguity</p>
            <h2 id="access-heading" className="mt-3 max-w-3xl font-[var(--public-font-display)] text-3xl font-semibold md:text-5xl">
              Explore first. Add the access that fits your work.
            </h2>
          </div>
          <Link href="/access" prefetch={false} className="inline-flex min-h-11 items-center text-base font-bold text-[var(--public-brass)] hover:text-[#f2d697]">
            Compare access details
          </Link>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-border)] sm:grid-cols-2 xl:grid-cols-4">
          {accessOptions.map(([title, copy]) => (
            <article key={title} className="bg-[#211d18] p-5">
              <h3 className="font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{title}</h3>
              <p className="mt-3 text-base leading-7 text-[#d5ccbd]">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
