import Link from 'next/link';
import { Caravan, HeartHandshake, Home, ServerCog, Utensils } from 'lucide-react';

import { PublicAuthControls } from '@/features/account/client/auth';
import { SupportCheckoutActions } from '@/features/billing/client';
import { getCreatorSupportOfferConfiguration, SUPPORT_MONTHLY_AMOUNTS_CENTS } from '@/features/billing/server';
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
  ['Food and daily life', 'The ordinary things that make it possible to sit down and keep building.', Utensils],
  ['Housing and stability', 'A steady place to live, work, rest, and keep moving forward.', Home],
  ['Transportation', 'Getting where I need to go while I build a more stable independent life.', Caravan],
  ['Business expenses', 'Hosting, software, testing, design resources, and the services that keep CardForge running.', ServerCog],
] as const;

export default async function SupportPage() {
  const businessIdentity = await getCachedBusinessIdentity();
  const supportOffers = getCreatorSupportOfferConfiguration();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/support">
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'Support Cameron', path: '/support' },
      ])} />
      <section className="border-b border-[var(--public-border)] bg-[radial-gradient(circle_at_80%_15%,#30200f_0%,#0c0b09_42%)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl">
          <HeartHandshake className="h-7 w-7 text-[var(--public-brass)]" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-[var(--public-brass)]">Support the journey</p>
          <h1 className="mt-2 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-ivory)] md:text-5xl">Help me keep building.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            CardForge is part of how I’m building a more stable life through independent products. Voluntary support helps give me the time and breathing room to keep learning, creating, and improving the work.
          </p>
          <div className="mt-7 border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
            <h2 className="font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">Want CardForge too?</h2>
            <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">
              Creator Pass is the best way to support CardForge as a business. You get the product access that comes with the subscription, and CardForge gets dependable support to keep growing.
            </p>
            <Link href="/access" prefetch={false} className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]">See Creator Pass</Link>
          </div>
          {supportOffers ? (
            <SupportCheckoutActions
              currency={supportOffers.currency}
              monthlyAmountsCents={SUPPORT_MONTHLY_AMOUNTS_CENTS}
              oneTimeMaximumCents={supportOffers.oneTimeMaximumCents}
              oneTimeMinimumCents={supportOffers.oneTimeMinimumCents}
              oneTimePresetCents={supportOffers.oneTimePresetCents}
              portalUrl={supportOffers.portalUrl}
            />
          ) : (
            <div role="status" className="mt-4 border-l-2 border-[var(--public-brass)] bg-[#21170d] p-4 text-base font-semibold text-[var(--public-ivory)]">
              Payments are not active yet. This page explains the separation before payment options are enabled.
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">What personal support can help with</h2>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">In plain terms: food, housing, transportation, development time, and the business expenses behind the work.</p>
          <div className="mt-7 grid gap-px overflow-hidden border border-[var(--public-border)] bg-[var(--public-border)] md:grid-cols-2">
            {uses.map(([title, copy, Icon]) => (
              <article key={title} className="bg-[var(--public-surface)] p-5">
                <Icon className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
                <h3 className="mt-3 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{title}</h3>
                <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--public-surface)] px-5 py-9 text-[var(--public-ivory)] md:px-8 md:py-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-2xl font-semibold">The simple, honest version</h2>
          <div className="mt-4 max-w-4xl space-y-2 text-base leading-7 text-[var(--public-muted-text)]">
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
