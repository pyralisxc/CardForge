import Link from 'next/link';
import { ArrowRight, Compass, Layers3, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
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

const priorities = [
  'Show complete card systems and the real workflow behind them.',
  'Make the studio more accessible, dependable, and clear to operate.',
  'Keep creator projects local-first while improving production-ready exports.',
] as const;

export default async function CameronPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <StructuredData value={createFounderProfileStructuredData(businessIdentity)} />
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'About Cameron', path: '/cameron' },
      ])} />
      <PublicSiteHeader currentPath="/cameron" />

      <section className="border-b border-[#5f4526] bg-[#120e09] px-5 py-14 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[12rem_1fr] md:items-center">
          <div className="grid aspect-square place-items-center border border-[#7d5a2e] bg-[#181109]" aria-hidden="true">
            <UserRound className="h-16 w-16 text-[#e2aa4a]" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e2aa4a]">Independent founder</p>
            <h1 className="mt-4 font-serif text-4xl font-semibold text-[#fff1c7] md:text-5xl">Cameron Locke</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#d2bd91]">
              I create and operate CardForge Studio as an independent sole proprietor based in Oregon. I am building it to make complete, consistent card systems practical without rebuilding every card by hand.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          <article className="border border-[#5f4526] bg-[#15100a] p-6">
            <Layers3 className="h-6 w-6 text-[#e2aa4a]" />
            <h2 className="mt-4 font-serif text-2xl text-[#ffe6a8]">Why CardForge exists</h2>
            <p className="mt-3 text-base leading-7 text-[#c7b288]">
              CardForge treats a deck as a reusable production system: one template, structured source data, a full-set review, and clean exports. The goal is practical creative control, not one-card mockups.
            </p>
          </article>
          <article className="border border-[#5f4526] bg-[#15100a] p-6">
            <Compass className="h-6 w-6 text-[#e2aa4a]" />
            <h2 className="mt-4 font-serif text-2xl text-[#ffe6a8]">Current priorities</h2>
            <ul className="mt-3 space-y-3 text-base leading-7 text-[#c7b288]">
              {priorities.map((priority) => <li key={priority}>• {priority}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className="border-t border-[#5f4526] bg-[#100d09] px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-[#fff1c7]">Follow the work</h2>
            <p className="mt-2 text-sm leading-6 text-[#baa67e]">See what has shipped, what is next, or contact Cameron directly.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
              <Link href="/roadmap" prefetch={false}>Roadmap <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
              <Link href="/contact" prefetch={false}>Contact</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
