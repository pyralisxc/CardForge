import Link from 'next/link';

import type { ProjectFileAccessPolicy } from '@/domain/entitlements';

export const getAccessComparisonOptions = (projectFileAccess: ProjectFileAccessPolicy, creatorPassVisible = true) => [
  {
    title: 'Start free',
    copy: projectFileAccess === 'free'
      ? 'Open the Studio, make cards, and keep portable CardForge project files before you pay for anything.'
      : 'Open the Studio, make cards, and see how your set comes together before you pay for anything.',
    action: 'Try the Studio',
    href: '/studio',
  },
  {
    title: 'Creator Pass',
    copy: projectFileAccess === 'free'
      ? 'Creator Pass adds watermark-free PNG, PDF, and ZIP downloads. Portable CardForge project files remain free.'
      : 'Creator Pass adds watermark-free PNG, PDF, and ZIP downloads plus portable CardForge project files.',
    action: 'See Creator Pass',
    href: '/account',
  },
].filter((option) => creatorPassVisible || option.title !== 'Creator Pass');

export function AccessComparison({ projectFileAccess, creatorPassVisible = true }: { projectFileAccess: ProjectFileAccessPolicy; creatorPassVisible?: boolean }) {
  const accessOptions = getAccessComparisonOptions(projectFileAccess, creatorPassVisible);
  return (
    <section aria-labelledby="access-heading" className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 text-[var(--public-ivory)] md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--public-brass)]">Choose your next step</p>
            <h2 id="access-heading" className="mt-2 max-w-3xl font-[var(--public-font-display)] text-3xl font-semibold md:text-4xl">
              Start free. Upgrade when you need watermark-free downloads.
            </h2>
          </div>
          <Link href="/account" prefetch={false} className="inline-flex min-h-11 items-center text-base font-bold text-[var(--public-brass)] hover:text-[#f2d697]">
            Check your access
          </Link>
        </div>
        <div className={`mt-7 grid gap-px overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-border)] ${accessOptions.length > 1 ? 'md:grid-cols-2' : ''}`}>
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
