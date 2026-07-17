import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Compass, Layers3 } from 'lucide-react';

import { PublicAuthControls } from '@/features/account/client/auth';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client';
import {
  createBreadcrumbStructuredData,
  createFounderProfileStructuredData,
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'About Cameron Locke',
  description: 'Meet Cameron Locke, the independent creator and Oregon sole proprietor operating CardForge Studio.',
  path: '/cameron',
});

const principles = [
  'Keep creator projects local-first unless sharing is intentional.',
  'Build for complete-set consistency instead of isolated card mockups.',
  'Show real shipped work and be direct about the product’s beta stage.',
] as const;

const priorities = [
  'Make full-set proofing and production exports more dependable.',
  'Improve accessibility across public pages and editor interactions.',
  'Grow the reviewed template library without weakening creator ownership.',
] as const;

export default async function CameronPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/cameron">
      <StructuredData value={createFounderProfileStructuredData(businessIdentity)} />
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'About Cameron', path: '/cameron' },
      ])} />
      <section className="bg-[var(--public-ivory)] px-5 py-14 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[11rem_1fr] md:items-center">
          <div className="grid aspect-[4/5] place-items-center rounded-[var(--public-radius)] border border-[#a48f6d] bg-[var(--public-charcoal)]" aria-hidden="true">
            <Image src="/brand/cardforge-studio/brand-mark.svg" alt="" width={66} height={88} className="h-24 w-auto" />
          </div>
          <div>
            <p className="text-base font-semibold uppercase tracking-[0.14em] text-[#76551c]">Independent founder</p>
            <h1 className="mt-3 font-[var(--public-font-display)] text-4xl font-semibold text-[var(--public-text)] md:text-6xl">Cameron Locke</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5f5548]">
              I build and operate CardForge Studio as an Oregon sole proprietor. I am keeping that identity public because an independently built product should make the person and operating structure behind it easy to understand.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f0e5d2] px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          <article className="rounded-[var(--public-radius)] border border-[#ad9d84] bg-[var(--public-ivory)] p-6">
            <Layers3 className="h-6 w-6 text-[#775817]" aria-hidden="true" />
            <h2 className="mt-4 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)]">Why I built CardForge</h2>
            <p className="mt-4 text-base leading-7 text-[#5f5548]">
              Producing a deck or reference set means repeating the same visual decisions across many changing records. CardForge exists to make that work systematic: one template, structured source data, complete-set review, and clean exports.
            </p>
          </article>
          <article className="rounded-[var(--public-radius)] border border-[#ad9d84] bg-[var(--public-ivory)] p-6">
            <Compass className="h-6 w-6 text-[#775817]" aria-hidden="true" />
            <h2 className="mt-4 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)]">Operating principles</h2>
            <ul className="mt-4 space-y-3 text-base leading-7 text-[#5f5548]">
              {principles.map((principle) => <li key={principle}>• {principle}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className="bg-[var(--public-charcoal)] px-5 py-12 text-[var(--public-ivory)] md:px-8 md:py-16">
        <div className="mx-auto grid max-w-5xl gap-7 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h2 className="font-[var(--public-font-display)] text-3xl font-semibold">Current priorities</h2>
            <ul className="mt-4 space-y-2 text-base leading-7 text-[#d5ccbd]">
              {priorities.map((priority) => <li key={priority}>• {priority}</li>)}
            </ul>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--public-brass)]">Roadmap <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            <Link href="/contact" prefetch={false} className="inline-flex min-h-11 items-center font-semibold">Contact</Link>
            <Link href="/support" prefetch={false} className="inline-flex min-h-11 items-center font-semibold">Support the work</Link>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
