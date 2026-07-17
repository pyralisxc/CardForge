import Link from 'next/link';
import { Database, FileCheck2, Layers3, ShieldCheck } from 'lucide-react';

import { PublicAuthControls } from '@/features/account/client/auth';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client';
import { createBreadcrumbStructuredData, StructuredData } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'About CardForge',
  description: 'Learn why CardForge uses reusable templates, structured data, and a local-first workflow to produce complete card sets.',
  path: '/about',
});

const principles = [
  ['Reusable by design', 'A card system should preserve its layout and rules while structured content changes across the set.', Layers3],
  ['Local-first ownership', 'Project data and uploaded art stay in your browser workspace or downloaded files unless you intentionally submit or share them.', ShieldCheck],
  ['Structured production', 'CSV, JSON, and mapped fields turn repeated layout work into a reviewable production process.', Database],
  ['Proof before export', 'The complete set stays visible so inconsistencies can be caught before clean files are prepared.', FileCheck2],
] as const;

export default async function AboutPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/about">
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'About CardForge', path: '/about' },
      ])} />
      <section className="bg-[var(--public-ivory)] px-5 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-base font-semibold uppercase tracking-[0.14em] text-[#76551c]">About CardForge</p>
          <h1 className="mt-3 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-text)] md:text-6xl">
            Card creation built around systems, not isolated mockups.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5f5548]">
            CardForge is a local-first production workspace for turning one reusable template and structured data into a complete, consistent set.
          </p>
        </div>
      </section>

      <section className="bg-[#f0e5d2] px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)] md:text-5xl">Why reusable systems matter</h2>
          <p className="mt-4 max-w-4xl text-lg leading-8 text-[#5f5548]">
            A one-card mockup tool helps with a single image. CardForge is designed for the harder part: keeping dozens of fronts, backs, fields, and exports aligned as one production system.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {principles.map(([title, copy, Icon]) => (
              <article key={title} className="rounded-[var(--public-radius)] border border-[#ad9d84] bg-[var(--public-ivory)] p-6">
                <Icon className="h-6 w-6 text-[#775817]" aria-hidden="true" />
                <h3 className="mt-4 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-text)]">{title}</h3>
                <p className="mt-3 text-base leading-7 text-[#5f5548]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--public-charcoal)] px-5 py-12 text-[var(--public-ivory)] md:px-8 md:py-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-[var(--public-font-display)] text-3xl font-semibold">An honest public beta</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#d5ccbd]">CardForge is independently built and actively improving. The roadmap shows what has shipped and where the production workflow is heading.</p>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/examples" prefetch={false} className="inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]">See complete sets</Link>
            <Link href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">View roadmap</Link>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
