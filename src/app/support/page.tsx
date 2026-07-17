import Link from 'next/link';
import { Accessibility, BookOpenCheck, ServerCog, TestTube2 } from 'lucide-react';

import { PublicAuthControls } from '@/features/account/client/auth';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client';
import { createBreadcrumbStructuredData, StructuredData } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Support Cameron',
  description: 'Learn how voluntary creator support will help Cameron Locke continue independently developing CardForge Studio.',
  path: '/support',
});

const uses = [
  ['Hosting and providers', 'Keep the public site, operational services, and production workflow available.', ServerCog],
  ['Accessibility work', 'Improve keyboard, screen-reader, contrast, and editor interaction support.', Accessibility],
  ['Testing', 'Expand automated coverage and hands-on production checks before releases.', TestTube2],
  ['Documentation and design', 'Make the workflow clearer and strengthen real product examples.', BookOpenCheck],
] as const;

export default async function SupportPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/support">
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'Support Cameron', path: '/support' },
      ])} />
      <section className="bg-[var(--public-ivory)] px-5 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-base font-semibold uppercase tracking-[0.14em] text-[#76551c]">Support independent development</p>
          <h1 className="mt-3 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-text)] md:text-6xl">Support Cameron’s work on CardForge.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5f5548]">
            Support will be voluntary and will help Cameron continue developing, hosting, testing, documenting, and improving CardForge Studio.
          </p>
          <div role="status" className="mt-7 rounded-[var(--public-radius)] border border-[#9f8a69] bg-[#f2e5cf] p-5 text-base font-semibold text-[var(--public-text)]">
            Payments are not active yet. This page explains the planned separation before any payment option is enabled.
          </div>
        </div>
      </section>

      <section className="bg-[#f0e5d2] px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)] md:text-5xl">What support will fund</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {uses.map(([title, copy, Icon]) => (
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
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold">Clear boundaries</h2>
          <div className="mt-5 max-w-4xl space-y-3 text-base leading-7 text-[#d5ccbd]">
            <p>Creator support is separate from Creator Pass and does not provide CardForge product access unless an offering explicitly says otherwise.</p>
            <p>Support is not a charitable donation or tax-deductible contribution.</p>
            <p>Support does not provide equity, ownership, profit rights, voting control, guaranteed features, or guaranteed roadmap influence.</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-5">
            <Link href="/supporter-terms" prefetch={false} className="inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]">Read supporter terms</Link>
            <Link href="/refund" prefetch={false} className="inline-flex min-h-11 items-center font-semibold">Refund and cancellation policy</Link>
            <Link href="/access" prefetch={false} className="inline-flex min-h-11 items-center font-semibold">Compare product access</Link>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
