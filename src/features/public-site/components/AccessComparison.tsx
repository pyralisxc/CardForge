import Link from 'next/link';

const accessOptions = [
  {
    title: 'Start free',
    copy: 'Open the Studio, make cards, and see how your set comes together before you pay for anything.',
    action: 'Try the Studio',
    href: '/studio',
  },
  {
    title: 'Creator Pass',
    copy: 'When you are ready for clean downloads, Creator Pass gives you product access and supports the business behind CardForge.',
    action: 'See Creator Pass',
    href: '/account',
  },
] as const;

export function AccessComparison() {
  return (
    <section aria-labelledby="access-heading" className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 text-[var(--public-ivory)] md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--public-brass)]">Choose your next step</p>
            <h2 id="access-heading" className="mt-2 max-w-3xl font-[var(--public-font-display)] text-3xl font-semibold md:text-4xl">
              Start free. Upgrade only when clean downloads matter.
            </h2>
          </div>
          <Link href="/account" prefetch={false} className="inline-flex min-h-11 items-center text-base font-bold text-[var(--public-brass)] hover:text-[#f2d697]">
            Check your access
          </Link>
        </div>
        <div className="mt-7 grid gap-px overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-border)] md:grid-cols-2">
          {accessOptions.map((option) => (
            <article key={option.title} className="bg-[var(--public-surface)] p-5">
              <h3 className="font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{option.title}</h3>
              <p className="mt-2 max-w-xl text-base leading-7 text-[var(--public-muted-text)]">{option.copy}</p>
              <Link href={option.href} prefetch={false} className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--public-brass)] hover:text-[#f2d697]">
                {option.action}
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--public-muted-text)]">
          Developers can help improve shared CardForge tools and artwork through the Developer Program.
        </p>
      </div>
    </section>
  );
}
