import Link from 'next/link';
import { Download, Eye, Layers3, ShieldCheck } from 'lucide-react';

import { PublicAuthControls } from '@/features/account/client/auth';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client';
import { createBreadcrumbStructuredData, StructuredData } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'About CardForge',
  description: 'Learn how CardForge helps you design one card and turn it into a complete, consistent set.',
  path: '/about',
});

const principles = [
  ['Make it once', 'Create the look once, then reuse it across every card that belongs in the set.', Layers3],
  ['Your work stays with you', 'Your projects and artwork stay in your browser or downloaded files unless you choose to share them.', ShieldCheck],
  ['See the whole set', 'Look through every card together so small mistakes are easy to spot before you finish.', Eye],
  ['Download when it feels right', 'When the set is ready, save clean card images, a PDF, or a bundle for your next step.', Download],
] as const;

export default async function AboutPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/about">
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'About CardForge', path: '/about' },
      ])} />
      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-base font-semibold text-[var(--public-brass)]">About CardForge</p>
          <h1 className="mt-2 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-ivory)] md:text-5xl">
            Make one card. Build the whole set.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            CardForge is for people who have more than one card in their head. You create the shared look, add what changes from card to card, and let the Studio keep everything together.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">Why it feels different</h2>
          <p className="mt-3 max-w-4xl text-lg leading-8 text-[var(--public-muted-text)]">
            Most card tools stop after one nice picture. CardForge helps you carry that look across a deck, game, reference set, badge run, or whatever else you are building.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {principles.map(([title, copy, Icon]) => (
              <article key={title} className="border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
                <Icon className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
                <h3 className="mt-3 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{title}</h3>
                <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--public-surface)] px-5 py-10 text-[var(--public-ivory)] md:px-8 md:py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-[var(--public-font-display)] text-3xl font-semibold">An honest public beta</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--public-muted-text)]">CardForge is independently built and actively improving. The roadmap shows what already works and what I’m building next.</p>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/#interactive-showcase" prefetch={false} className="inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]">See CardForge in action</Link>
            <Link href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">View roadmap</Link>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
