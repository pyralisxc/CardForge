import Link from 'next/link';
import { Database, FileDown, Hammer, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PublicSiteHeader } from '@/features/app-shell/components/PublicSiteHeader';
import { createSiteContentMap } from '@/lib/ownerConsole';
import { getSiteContentBlocks } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

const pillars = [
  {
    icon: Database,
    title: 'Structured creation',
    copy: 'CardForge treats cards like reusable production systems powered by variables, rows of data, and repeatable export settings.',
  },
  {
    icon: Users,
    title: 'Developer-shaped library',
    copy: 'Developers improve the shared library through a reviewed pipeline instead of scattering assets through one-off folders.',
  },
  {
    icon: FileDown,
    title: 'Production-minded exports',
    copy: 'The studio is built around proofing, clean PNG/PDF/ZIP output, Tabletop-ready files, and workflows that can grow beyond a single prototype.',
  },
] as const;

export default async function AboutPage() {
  const siteCopy = createSiteContentMap(await getSiteContentBlocks());

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <PublicSiteHeader currentPath="/about" />

      <section className="border-b border-[#5f4526] bg-[#120e09] px-5 py-14 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <Hammer className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">About CardForge</span>
          </div>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight text-[#fff1c7] md:text-5xl">
            {siteCopy['about.hero.headline']}
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[#d2bd91]">
            {siteCopy['about.hero.body']}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
              <Link href="/studio" prefetch={false}>Open Studio</Link>
            </Button>
            <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
              <Link href="/developer" prefetch={false}>Developer Program</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="border border-[#5f4526] bg-[#15100a] p-5">
              <pillar.icon className="h-5 w-5 text-[#e2aa4a]" />
              <h2 className="mt-4 font-serif text-xl text-[#ffe6a8]">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#c7b288]">{pillar.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
