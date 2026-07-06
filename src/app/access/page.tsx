import Link from 'next/link';
import { Gift, ShieldCheck, Sparkles, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PublicSiteHeader } from '@/features/app-shell/components/PublicSiteHeader';
import { createSiteContentMap } from '@/lib/ownerConsole';
import { getSiteContentBlocks } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

const accessLevels = [
  {
    title: 'Free studio preview',
    copy: 'Try the editor, build templates, preview generated cards, and keep local project data in your browser or downloaded files.',
  },
  {
    title: 'Founder Beta seat',
    copy: 'Claim demo access while a wave has seats open. Founder Beta is the current path for testing clean export during the preview window.',
  },
  {
    title: 'Creator Pass',
    copy: 'The paid creator tier is the planned home for clean exports, stronger shared libraries, and production workflow upgrades.',
  },
  {
    title: 'Developer access',
    copy: 'Approved contributors use the private asset hub to submit, vote on, and improve the shared library that powers the studio.',
  },
] as const;

export default async function AccessPage() {
  const siteCopy = createSiteContentMap(await getSiteContentBlocks());

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <PublicSiteHeader currentPath="/access" />

      <section className="border-b border-[#5f4526] bg-[#120e09] px-5 py-14 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div>
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <Gift className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Access and demo seats</span>
            </div>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight text-[#fff1c7] md:text-5xl">
              {siteCopy['access.hero.headline']}
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#d2bd91]">
              {siteCopy['access.hero.body']}
            </p>
          </div>
          <aside className="border border-[#7d5a2e] bg-[#15100a] p-5">
            <div className="flex items-center gap-3 text-[#ffe7ad]">
              <ShieldCheck className="h-5 w-5 text-[#e2aa4a]" />
              <h2 className="font-serif text-xl">Demo path</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#c7b288]">
              Sign in, open your account page, and claim Founder Beta if the current wave still has room.
            </p>
            <Button asChild className="mt-5 w-full bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
              <Link href="/account" prefetch={false}>Check Access</Link>
            </Button>
          </aside>
        </div>
      </section>

      <section className="px-5 py-12 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          {accessLevels.map((level, index) => (
            <article key={level.title} className="border border-[#5f4526] bg-[#15100a] p-5">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e2aa4a]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="mt-3 font-serif text-xl text-[#ffe6a8]">{level.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#c7b288]">{level.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[#5f4526] bg-[#100d09] px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <Sparkles className="h-5 w-5" />
            <p className="text-sm text-[#d2bd91]">{siteCopy['access.creatorPool.note']}</p>
          </div>
          <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
            <Link href="/creator-pool" prefetch={false}>
              <Users className="mr-2 h-4 w-4" />
              Creator Pool Notice
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
