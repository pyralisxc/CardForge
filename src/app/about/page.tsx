import Link from 'next/link';
import {
  ArrowRight,
  Eye,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { PublicAuthControls } from '@/features/account/client/auth';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client';
import { createBreadcrumbStructuredData, StructuredData } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'About CardForge',
  description: 'See how CardForge Studio helps everyday creators build highly customized card sets today and grow toward reusable printable design systems.',
  path: '/about',
});

const principles = [
  ['Design the system once', 'Build a reusable layout, then carry the visual rules across every item in the set.', Layers3],
  ['Your work stays with you', 'Your projects and artwork stay in your browser or downloaded files unless you choose to share them.', ShieldCheck],
  ['Tune every detail', 'Mix shared structure with card-specific text, art, colors, and positioning so the result still feels personal.', Sparkles],
  ['Review the whole run', 'Inspect the complete set together, catch inconsistencies, then export images, a PDF, or a ZIP when it is ready.', Eye],
] as const;

export default async function AboutPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/about">
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'About CardForge Studio', path: '/about' },
      ])} />

      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-base font-semibold text-[var(--public-brass)]">About CardForge Studio</p>
          <h1 className="mt-2 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-ivory)] md:text-5xl">
            Give everyday creators room to make it their own.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            CardForge Studio turns a reusable design and structured content into a consistent set without taking the creative decisions away from you. It is built for people who want deep customization without rebuilding every item by hand.
          </p>
          <div className="mt-6 flex flex-wrap gap-5">
            <Link href="/studio" prefetch={false} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--public-brass)]">
              Try the Studio <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/cameron" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">
              Meet the developer
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
            Customization without repetitive work
          </h2>
          <p className="mt-3 max-w-4xl text-lg leading-8 text-[var(--public-muted-text)]">
            The goal is a practical middle ground: enough structure to keep a large set coherent, and enough control for the finished work to belong unmistakably to its creator.
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

      <section className="border-b border-[var(--public-border)] bg-[var(--public-surface)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
            Cards are the starting point
          </h2>
          <p className="mt-3 max-w-4xl text-lg leading-8 text-[var(--public-muted-text)]">
            Card sets are the product today. The wider ambition is a creation system that can serve many kinds of repeatable, printable design work while keeping the same data-driven workflow.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="border border-[var(--public-border)] bg-[var(--public-charcoal)] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--public-brass)]">Available now</p>
              <h3 className="mt-2 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">Complete custom card sets</h3>
              <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">
                Reusable card layouts, structured data, whole-set review, browser-based project control, and downloadable production files.
              </p>
            </article>
            <article className="border border-[var(--public-border)] bg-[var(--public-charcoal)] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--public-brass)]">Long-term direction</p>
              <h3 className="mt-2 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">More kinds of printable creation</h3>
              <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">
                Our future printable formats may include game aids, reference sheets, labels, badges, tokens, and other reusable layouts. These formats are a direction, not currently available features.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="border-l-2 border-[var(--public-brass)] bg-[var(--public-surface)] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--public-brass)]">Independent brand notice</p>
            <h2 className="mt-2 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)]">
              Building openly in a competitive, fast-moving category
            </h2>
            <div className="mt-3 grid gap-3 text-base leading-7 text-[var(--public-muted-text)]">
              <p>
                Several products use similar forge-inspired names. CardForge Studio is independent and not affiliated with those products. We monitor naming and trademark obligations and will adapt the brand if a legal requirement makes that necessary.
              </p>
              <p>
                Long term, we would like to acquire cardforge.com, currently listed for sale by a third party, if the timing and cost make business sense. Its availability and asking price can change; this is an ambition, not a commitment or a current operating expense.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.3fr_0.7fr] md:items-start">
          <div>
            <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
              Growing with creators and developers
            </h2>
            <p className="mt-3 text-lg leading-8 text-[var(--public-muted-text)]">
              Public roadmap voting helps creators influence priorities. CardForge is also exploring whether a future developer compensation program could share defined program revenue with qualified contributors to shared creation tools.
            </p>
            <p className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">
              That program is not active today, is not committed or guaranteed, and may change or never launch. No current contribution creates a developer balance, profit right, payment promise, or payout entitlement. Any launch would still require billing reconciliation, refund and dispute handling, eligibility rules, final terms, and payout infrastructure.
            </p>
          </div>
          <div className="grid gap-3 border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
            <Link href="/developer" prefetch={false} className="inline-flex min-h-11 items-center justify-between gap-3 font-bold text-[var(--public-brass)]">
              Developer program <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center justify-between gap-3 font-semibold text-[var(--public-ivory)]">
              Public roadmap <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/cameron" prefetch={false} className="inline-flex min-h-11 items-center justify-between gap-3 font-semibold text-[var(--public-ivory)]">
              About Cameron <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[var(--public-surface)] px-5 py-10 text-[var(--public-ivory)] md:px-8 md:py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-[var(--public-font-display)] text-3xl font-semibold">An honest public beta</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--public-muted-text)]">
              CardForge Studio is independently built and actively improving. The public roadmap separates what works now from what is still planned.
            </p>
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
