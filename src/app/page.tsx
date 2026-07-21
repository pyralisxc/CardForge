import Link from 'next/link';
import { ArrowRight, Gift } from 'lucide-react';

import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  AccessComparison,
  FounderStrip,
  InteractiveStudioShowcase,
  OutcomeHero,
  WorkflowProof,
} from '@/features/public-site/client/landing';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import {
  createCardForgeStructuredData,
  createSiteContentMap,
  getCachedSiteContentBlocks,
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Build Complete Card Sets',
  description: 'Create highly customized card sets from reusable layouts and structured data, then review and export the whole set in your browser.',
  path: '/',
});

export default async function LandingPage() {
  const [siteContentBlocks, businessIdentity] = await Promise.all([
    getCachedSiteContentBlocks('landing'),
    getCachedBusinessIdentity(),
  ]);
  const siteCopy = createSiteContentMap(siteContentBlocks);

  return (
    <PublicSiteShell
      businessIdentity={businessIdentity}
      currentPath="/"
    >
      <StructuredData value={createCardForgeStructuredData(businessIdentity)} />
      <OutcomeHero />
      <InteractiveStudioShowcase />
      <WorkflowProof />

      <section aria-labelledby="founder-beta-heading" className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-7 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 border-l-2 border-[var(--public-brass)] bg-[var(--public-surface)] p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-[var(--public-brass)]">
              <Gift className="h-5 w-5" aria-hidden="true" /> Founder Beta
            </p>
            <h2 id="founder-beta-heading" className="mt-2 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">
              {siteCopy['landing.demo.heading']}
            </h2>
            <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--public-muted-text)]">
              {siteCopy['landing.demo.body']}
            </p>
          </div>
          <Link
            href="/account"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] border border-[var(--public-border)] px-5 text-base font-bold text-[var(--public-ivory)] hover:border-[var(--public-brass)]"
          >
            Check beta access <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <AccessComparison />
      <FounderStrip />

      <section className="bg-[radial-gradient(circle_at_center,#2a1a0c_0%,#0c0b09_62%)] px-5 py-11 text-center md:px-8 md:py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
            Build your first set.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-[var(--public-muted-text)]">
            Open the Studio, choose a starting point, and make something that feels like yours.
          </p>
          <Link
            href="/studio"
            prefetch={false}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-brass)] px-6 text-base font-bold text-[var(--public-obsidian)] shadow-[var(--public-shadow)] hover:bg-[#f0bd58]"
          >
            Try the Studio <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicSiteShell>
  );
}
