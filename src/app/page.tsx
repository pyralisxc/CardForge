import Link from 'next/link';
import { ArrowRight, Gift } from 'lucide-react';

import { PublicAuthControls } from '@/features/account/client/auth';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  AccessComparison,
  FounderStrip,
  OutcomeHero,
  PublicSiteShell,
  WorkflowProof,
  createSiteContentMap,
} from '@/features/public-site/client';
import {
  createCardForgeStructuredData,
  getCachedSiteContentBlocks,
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Build Complete Card Sets',
  description: 'Design one reusable template, connect structured data, review the complete set, and export production-ready card files.',
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
      accountSlot={<PublicAuthControls />}
      currentPath="/"
    >
      <StructuredData value={createCardForgeStructuredData(businessIdentity)} />
      <OutcomeHero />
      <WorkflowProof />

      <section aria-labelledby="founder-beta-heading" className="bg-[var(--public-ivory)] px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 rounded-[var(--public-radius)] border border-[#a48f6d] bg-white p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold uppercase tracking-[0.14em] text-[#76551c]">
              <Gift className="h-5 w-5" aria-hidden="true" /> Founder Beta
            </p>
            <h2 id="founder-beta-heading" className="mt-3 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)]">
              {siteCopy['landing.demo.heading']}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#5f5548]">
              {siteCopy['landing.demo.body']}
            </p>
          </div>
          <Link
            href="/account"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] border border-[#8d7e68] px-5 text-base font-bold text-[var(--public-text)] hover:border-[#775817]"
          >
            Check beta access <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <AccessComparison />
      <FounderStrip />

      <section className="bg-[var(--public-ivory)] px-5 py-14 text-center md:px-8 md:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)] md:text-5xl">
            Ready to build the complete set?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#5f5548]">
            Start with one reusable template and see the full production workflow in the Studio.
          </p>
          <Link
            href="/studio"
            prefetch={false}
            className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-charcoal)] px-6 text-base font-bold text-[var(--public-ivory)] shadow-[var(--public-shadow)] hover:bg-[#2b2721]"
          >
            Try the Studio <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicSiteShell>
  );
}
