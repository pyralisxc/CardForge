import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  Database,
  FileDown,
  Gift,
  Layers3,
  PenTool,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { PublicSiteHeader } from '@/components/card-forge/PublicSiteHeader';
import { Button } from '@/components/ui/button';

const featureBands = [
  {
    icon: PenTool,
    title: 'Design the card',
    copy: 'Build layered fronts and backs with text, images, icons, frames, textures, and reusable variables.',
  },
  {
    icon: Database,
    title: 'Generate the set',
    copy: 'Fill one card by hand or turn CSV, JSON, and structured notes into a browsable batch.',
  },
  {
    icon: Layers3,
    title: 'Keep art organized',
    copy: 'Use the Starter Library, add signed-in local assets, and keep project work in your browser or files.',
  },
  {
    icon: FileDown,
    title: 'Export when ready',
    copy: 'Preview, proof, and unlock clean PDF, PNG, and ZIP files when the deck is ready to leave the studio.',
  },
];

const accessRows = [
  {
    label: 'Start free',
    detail: 'Open the studio, test templates, import data, preview cards, and save project files locally.',
  },
  {
    label: 'Add your art',
    detail: 'Sign in to unlock account-gated local uploads while your project files still stay in your browser or downloads.',
  },
  {
    label: 'Export clean files',
    detail: 'Creator Pass is the paid or beta export tier for clean PDF, PNG, ZIP, and stronger library assets.',
  },
];

const creationPaths = [
  'Trading-card layouts with frames, icons, textures, and rich text.',
  'Bulk decks generated from spreadsheets, JSON, or structured notes.',
  'Printable fronts and backs for prototypes, encounters, badges, and reference cards.',
];

const libraryLadder = [
  ['Starter Library', 'A ready set of official templates, textures, dividers, and parts.'],
  ['Local Assets', 'Your uploaded art stays in this browser workspace and project files.'],
  ['Creator Pass', 'Clean export plus higher-scored CardForge library assets.'],
  ['Forge Review', 'Approved developers help add new assets over time.'],
] as const;

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0c0b09] text-[#f7ead0]">
      <section className="relative min-h-[74vh] border-b border-[#8b6a34]/35">
        <Image
          src="/card-assets/landing/cardforge-hero-workbench.png"
          alt="Fantasy card-forging workbench with ornate cards, gilded frames, tools, parchment, and forge light"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,6,5,0.96)_0%,rgba(7,6,5,0.86)_28%,rgba(7,6,5,0.45)_56%,rgba(7,6,5,0.12)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0c0b09] to-transparent" />

        <PublicSiteHeader currentPath="/" showStudioCta variant="hero" />

        <div className="relative z-10 mx-auto flex min-h-[calc(74vh-80px)] max-w-7xl items-center px-5 pb-14 pt-8 md:px-8">
          <div className="max-w-2xl">
            <h1 className="font-serif text-4xl font-semibold leading-[1.02] text-[#fff1c7] md:text-6xl">
              Make the card. Generate the deck. Export the set.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#d9c39c]">
              CardForge is a compact card design studio for tabletop creators: design reusable templates, generate cards from data, organize custom art, and export clean files when your set is ready.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#f0dca8]">
              No sign-in is required to design. Your projects stay in this browser or in files you choose to export.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
                <Link href="/studio" prefetch={false}>
                  Start Creating <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-[#d8b365]/70 bg-[#120e09]/65 text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                <Link href="/account" prefetch={false}>Account & Export</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#c8b07f]">
              <span className="border border-[#87683a]/60 bg-[#100d09]/65 px-3 py-2">Try before sign-in</span>
              <span className="border border-[#87683a]/60 bg-[#100d09]/65 px-3 py-2">Local project files</span>
              <span className="border border-[#87683a]/60 bg-[#100d09]/65 px-3 py-2">Bulk generation</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#6d4f2b] bg-[#17110b] px-5 py-8 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <Gift className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Founder Beta demo</span>
            </div>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-[#fff1c7] md:text-4xl">
              Free demo seats are open for the current wave.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#cbb58b]">
              Claiming a Founder Beta seat unlocks clean export access for the demo window while seats remain open. It is the fastest way to test the full studio before CardForge moves into wider paid access.
            </p>
          </div>
          <div className="border border-[#7d5a2e] bg-[#100c08] p-4 lg:w-80">
            <div className="flex items-center gap-3 text-[#ffe7ad]">
              <Users className="h-5 w-5 text-[#e2aa4a]" />
              <span className="font-serif text-lg">Limited seats</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-[#c7b288]">
              Sign in, claim a seat if the wave still has openings, then export clean PNG, PDF, and ZIP files during the demo period.
            </p>
            <Button asChild className="mt-4 w-full bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
              <Link href="/account" prefetch={false}>
                Claim a demo seat <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-[#5c4324]/50 bg-[#100d09] px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-4">
          {featureBands.map((feature) => (
            <article key={feature.title} className="border border-[#5a4225] bg-[#17110b] p-4">
              <feature.icon className="h-5 w-5 text-[#e3a443]" />
              <h2 className="mt-3 font-serif text-lg font-semibold text-[#ffe6a8]">{feature.title}</h2>
              <p className="mt-2 text-sm leading-5 text-[#bea97f]">{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-b border-[#5c4324]/50 bg-[#0c0b09] px-5 py-12 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-[#fff1c7] md:text-4xl">
              Build playable prototypes without rebuilding every card.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#cbb58b]">
              Make one layout, bind the changing text, preview the output, then feed it rows of content. It is made for TCG-style cards, TTRPG decks, encounter cards, reference cards, badges, and print tests.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="bg-[#d69c3a] text-[#16100a] hover:bg-[#f1bd58]">
                <Link href="/studio" prefetch={false}>Start Creating</Link>
              </Button>
              <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                <Link href="/developer" prefetch={false}>Become a developer</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            {creationPaths.map((path) => (
              <div key={path} className="flex gap-3 border border-[#5f4526] bg-[#15100a] p-3">
                <CheckIcon />
                <p className="text-sm leading-5 text-[#d8c49a]">{path}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0c0b09] px-5 py-12 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Start fast</span>
            </div>
            <h2 className="mt-4 font-serif text-3xl font-semibold text-[#fff1c7] md:text-4xl">
              Try the studio first. Create an account when the work needs one.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#cbb58b]">
              You can explore the maker and generator before signing in. Accounts matter when you want account-gated local uploads, cleaner exports, Creator Pass assets, or the developer contribution path.
            </p>
            <div className="mt-6 flex gap-3">
              <Button asChild className="bg-[#d69c3a] text-[#16100a] hover:bg-[#f1bd58]">
                <Link href="/studio" prefetch={false}>Open Studio</Link>
              </Button>
              <Button asChild variant="ghost" className="text-[#f7d690] hover:bg-[#24180e] hover:text-[#fff3ca]">
                <Link href="/account" prefetch={false}>Check Access</Link>
              </Button>
            </div>
          </div>

          <div className="border border-[#5f4526] bg-[#15100a]">
            {accessRows.map((row, index) => (
              <div key={row.label} className="grid gap-3 border-b border-[#5f4526] p-4 last:border-b-0 md:grid-cols-[10rem_1fr]">
                <div className="flex items-center gap-3 font-serif text-base text-[#ffe1a1]">
                  <span className="text-[#d69c3a]">{String(index + 1).padStart(2, '0')}</span>
                  {row.label}
                </div>
                <p className="text-sm leading-5 text-[#c0aa80]">{row.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#5c4324]/50 bg-[#100d09] px-5 py-12 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="font-serif text-3xl font-semibold text-[#fff1c7] md:text-4xl">
              A card library that gets better as people use it.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#cbb58b]">
              Start with official defaults, add your own browser-local art, and unlock stronger libraries as your workflow grows. Developer-submitted assets enter review before they become shared library options.
            </p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {libraryLadder.map(([label, detail]) => (
              <article key={label} className="border border-[#5f4526] bg-[#15100a] p-3">
                <h3 className="font-serif text-lg text-[#ffe6a8]">{label}</h3>
                <p className="mt-2 text-sm leading-5 text-[#bea97f]">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#5c4324]/50 bg-[#15100a] px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.2em]">Ready at the table</span>
            </div>
            <h2 className="mt-2 font-serif text-2xl text-[#fff1c7]">Open the studio and make the first card.</h2>
            <p className="mt-2 text-sm text-[#baa67e]">Start with the editor. Add an account when your set needs uploads, export, or a deeper library.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
              <Link href="/studio" prefetch={false}>
                Start Creating <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
              <Link href="/account" prefetch={false}>
                <BookOpenCheck className="mr-2 h-5 w-5" /> View Account
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#5c4324]/50 bg-[#0c0b09] px-5 py-8 text-sm text-[#a99368] md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <span>CardForge Studio</span>
          <nav className="flex flex-wrap gap-4">
            <Link href="/privacy" prefetch={false} className="hover:text-[#ffe7ad]">Privacy</Link>
            <Link href="/terms" prefetch={false} className="hover:text-[#ffe7ad]">Terms</Link>
            <Link href="/refund" prefetch={false} className="hover:text-[#ffe7ad]">Refunds</Link>
            <Link href="/contact" prefetch={false} className="hover:text-[#ffe7ad]">Contact</Link>
            <Link href="/roadmap" prefetch={false} className="hover:text-[#ffe7ad]">Roadmap</Link>
            <Link href="/developer" prefetch={false} className="hover:text-[#ffe7ad]">Developers</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function CheckIcon() {
  return (
    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center border border-[#5f7f54] text-[#bde3a8]">
      <ShieldCheck className="h-3.5 w-3.5" />
    </span>
  );
}
