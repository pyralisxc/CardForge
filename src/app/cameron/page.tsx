import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Compass, HeartHandshake, Sparkles } from 'lucide-react';

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

const priorities = [
  'Make CardForge easier for someone opening it for the very first time.',
  'Keep improving how complete sets are checked and downloaded.',
  'Build a stable independent business around useful, creative products.',
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
      <section className="border-b border-[var(--public-border)] bg-[radial-gradient(circle_at_18%_16%,#30200f_0%,#0c0b09_42%)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[11rem_1fr] md:items-center">
          <div className="grid aspect-[4/5] place-items-center rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_0_40px_rgba(217,164,65,0.1)]" aria-hidden="true">
            <Image src="/brand/cardforge-studio/brand-mark.svg" alt="" width={66} height={88} className="h-24 w-auto" />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--public-brass)]">Hey, welcome in.</p>
            <h1 className="mt-2 font-[var(--public-font-display)] text-4xl font-semibold text-[var(--public-ivory)] md:text-5xl">I’m Cameron.</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
              I build and operate CardForge Studio as an Oregon sole proprietor. I use AI-assisted code generation alongside my own ideas, design choices, testing, and stubborn curiosity to turn useful product ideas into real software.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          <article className="border border-[var(--public-border)] bg-[var(--public-surface)] p-6">
            <Compass className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
            <h2 className="mt-3 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)]">The road here</h2>
            <p className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">
              My path has not been a straight line. I’ve spent time in Hawaii, traveled, and spent time hitchhiking. Those experiences taught me a lot about resourcefulness, freedom, hospitality, and how far you can get by staying curious and making the most of what is in front of you.
            </p>
          </article>
          <article className="border border-[var(--public-border)] bg-[var(--public-surface)] p-6">
            <Sparkles className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
            <h2 className="mt-3 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)]">What I’m building toward</h2>
            <p className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">
              CardForge is the first product in a larger independent journey. I’m building myself up through products that help people make things, solve real problems, and hopefully create a more stable and generous life along the way.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-[var(--public-surface)] px-5 py-10 text-[var(--public-ivory)] md:px-8 md:py-12">
        <div className="mx-auto grid max-w-5xl gap-7 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <HeartHandshake className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
            <h2 className="mt-3 font-[var(--public-font-display)] text-3xl font-semibold">Thanks for stopping by.</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--public-muted-text)]">Whether you try the Studio, share it with a friend, subscribe, or simply follow along, I’m glad you found the project.</p>
            <h3 className="mt-6 text-lg font-bold">What I’m focused on now</h3>
            <ul className="mt-3 space-y-2 text-base leading-7 text-[var(--public-muted-text)]">
              {priorities.map((priority) => <li key={priority}>• {priority}</li>)}
            </ul>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--public-brass)]">See what I’m building <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            <Link href="/contact" prefetch={false} className="inline-flex min-h-11 items-center font-semibold">Contact</Link>
            <Link href="/support" prefetch={false} className="inline-flex min-h-11 items-center font-semibold">Support the work</Link>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
