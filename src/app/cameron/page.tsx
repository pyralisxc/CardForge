import Link from 'next/link';
import { ArrowRight, Caravan, Compass, HeartHandshake, Home, ServerCog, Sparkles, Utensils } from 'lucide-react';

import { SupportCheckoutActions } from '@/features/billing/client';
import { getCreatorSupportOfferConfiguration, SUPPORT_MONTHLY_AMOUNTS_CENTS } from '@/features/billing/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import {
  createBreadcrumbStructuredData,
  createFounderProfileStructuredData,
  getCachedFounderProfile,
  getFounderPortraitPublicUrl,
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Cameron Locke — Founder of CardForge Studio',
  description: 'Meet Cameron Locke, the Oregon sole proprietor building CardForge Studio, and support his independent work.',
  path: '/cameron',
});

const supportUses = [
  ['Food and daily life', 'The ordinary things that make it possible to sit down and keep building.', Utensils],
  ['Housing and stability', 'A steady place to live, work, rest, and keep moving forward.', Home],
  ['Transportation', 'Getting where I need to go while I build a more stable independent life.', Caravan],
  ['Business expenses', 'Hosting, software, testing, design resources, and the services that keep CardForge running.', ServerCog],
] as const;

export default async function CameronPage() {
  const [businessIdentity, profile] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedFounderProfile(),
  ]);
  const supportOffers = getCreatorSupportOfferConfiguration();
  const rawPortraitUrl = getFounderPortraitPublicUrl(profile.portraitStoragePath);
  const portraitUrl = rawPortraitUrl
    ? `${rawPortraitUrl}?v=${encodeURIComponent(profile.updatedAt ?? 'current')}`
    : null;

  return (
    <PublicSiteShell businessIdentity={businessIdentity} currentPath="/cameron">
      <StructuredData value={createFounderProfileStructuredData(businessIdentity)} />
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'Cameron Locke', path: '/cameron' },
      ])} />

      <section className="border-b border-[var(--public-border)] bg-[radial-gradient(circle_at_18%_16%,#30200f_0%,#0c0b09_42%)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[12rem_1fr] md:items-center">
          <div
            role="img"
            aria-label={profile.portraitAlt}
            className="grid aspect-[4/5] place-items-center overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] bg-cover bg-center font-[var(--public-font-display)] text-5xl text-[var(--public-brass)] shadow-[0_0_40px_rgba(217,164,65,0.1)]"
            style={portraitUrl ? { backgroundImage: `url(${portraitUrl})` } : undefined}
          >
            {portraitUrl ? null : 'CL'}
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--public-brass)]">{profile.heroEyebrow}</p>
            <h1 className="mt-2 font-[var(--public-font-display)] text-4xl font-semibold text-[var(--public-ivory)] md:text-5xl">{profile.heroHeadline}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">{profile.introduction}</p>
            <div className="mt-6 flex flex-wrap gap-5">
              <Link href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--public-brass)]">See what I’m building <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link href="/contact" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">Contact me</Link>
              <Link href="#support" className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">Support the work</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          <article className="border border-[var(--public-border)] bg-[var(--public-surface)] p-6">
            <Compass className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
            <h2 className="mt-3 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)]">{profile.roadHeading}</h2>
            <p className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">{profile.roadBody}</p>
          </article>
          <article className="border border-[var(--public-border)] bg-[var(--public-surface)] p-6">
            <Sparkles className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
            <h2 className="mt-3 font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)]">{profile.currentHeading}</h2>
            <p className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">{profile.currentBody}</p>
            <h3 className="mt-6 text-lg font-bold text-[var(--public-ivory)]">What I’m focused on now</h3>
            <ul className="mt-3 space-y-2 text-base leading-7 text-[var(--public-muted-text)]">
              {profile.priorities.map((priority) => <li key={priority}>• {priority}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section id="support" className="scroll-mt-6 border-b border-[var(--public-border)] bg-[radial-gradient(circle_at_80%_15%,#30200f_0%,#0c0b09_42%)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl">
          <HeartHandshake className="h-7 w-7 text-[var(--public-brass)]" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-[var(--public-brass)]">Support the journey</p>
          <h2 className="mt-2 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-ivory)]">{profile.supportHeading}</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">{profile.supportIntroduction}</p>

          <div className="mt-7 border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
            <h3 className="font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">Want CardForge too?</h3>
            <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">Creator Pass is the best way to support CardForge as a business. It is a product subscription that includes CardForge access and gives the business dependable support to keep growing.</p>
            <Link href="/account" prefetch={false} className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]">See Creator Pass</Link>
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
            <div role="status" className="mt-4 border-l-2 border-[var(--public-brass)] bg-[#21170d] p-4 text-base font-semibold text-[var(--public-ivory)]">Payments are not active yet. This page explains the separation before payment options are enabled.</div>
          )}
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)]">What personal support can help with</h2>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">In plain terms: food, housing, transportation, development time, and the business expenses behind the work. {profile.supportUseSummary}</p>
          <div className="mt-7 grid gap-px overflow-hidden border border-[var(--public-border)] bg-[var(--public-border)] md:grid-cols-2">
            {supportUses.map(([title, copy, Icon]) => (
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
            <p>Creator support is voluntary, separate from Creator Pass, and does not provide CardForge product access unless an offering explicitly says otherwise.</p>
            <p>Support is not a charitable donation or tax-deductible contribution.</p>
            <p>Support does not provide equity, ownership, profit rights, voting control, guaranteed features, or guaranteed roadmap influence.</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-5">
            <Link href="/supporter-terms" prefetch={false} className="inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]">Read supporter terms</Link>
            <Link href="/refund" prefetch={false} className="inline-flex min-h-11 items-center font-semibold">Refund and cancellation policy</Link>
            <Link href="/account" prefetch={false} className="inline-flex min-h-11 items-center font-semibold">Manage CardForge access</Link>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
