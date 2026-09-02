import Link from 'next/link';
import { ArrowRight, Caravan, Compass, HeartHandshake, Home, ServerCog, Sparkles, Utensils } from 'lucide-react';
import { Suspense } from 'react';

import { ContributorPublicAuthSlot } from '@/features/contributor-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { SupportCheckoutActions } from '@/features/billing/client';
import { getCreatorSupportOfferConfiguration, SUPPORT_MONTHLY_AMOUNTS_CENTS } from '@/features/billing/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import {
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  ResponsiveSiteMediaImage,
} from '@/features/public-site/client';
import {
  createBreadcrumbStructuredData,
  createSiteContentMap,
  createFounderProfileStructuredData,
  getCachedFounderProfile,
  getCachedPublicSiteConfiguration,
  getCachedSiteContentBlocks,
  getCachedSiteMedia,
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { getMcpAllowances } from '@/features/mcp-usage/server';
import { OwnerPublicSiteControlsSlot } from '@/app/_components/OwnerPublicSiteControlsSlot';

export async function generateMetadata() {
  const content = createSiteContentMap(await getCachedSiteContentBlocks('founder'));
  return createPageMetadata({
    title: content['founder.meta.title'],
    description: content['founder.meta.description'],
    path: '/cameron',
  });
}

export default async function CameronPage() {
  const authConfigured = isClerkServerConfigPresent();
  const [businessIdentity, profile, siteMedia, siteConfiguration, siteContentBlocks, plans] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedFounderProfile(),
    getCachedSiteMedia(),
    getCachedPublicSiteConfiguration(),
    getCachedSiteContentBlocks('founder'),
    getMcpAllowances(),
  ]);
  const siteContent = createSiteContentMap(siteContentBlocks);
  const supportUses = [
    [siteContent['founder.support-use1.title'], siteContent['founder.support-use1.body'], Utensils],
    [siteContent['founder.support-use2.title'], siteContent['founder.support-use2.body'], Home],
    [siteContent['founder.support-use3.title'], siteContent['founder.support-use3.body'], Caravan],
    [siteContent['founder.support-use4.title'], siteContent['founder.support-use4.body'], ServerCog],
  ] as const;
  const supportOffers = getCreatorSupportOfferConfiguration();
  const creatorPlan = plans.find((plan) => plan.planKey === 'creator' && plan.isVisible);
  const portraitMedia = siteMedia.find((asset) => asset.slot === 'founder.portrait')
    ?? getDefaultSiteMedia('founder.portrait');
  const portraitUrl = getSiteMediaDisplaySrc(portraitMedia);
  const portraitDesktopGrid = {
    compact: 'md:grid-cols-[10rem_1fr]',
    standard: 'md:grid-cols-[12rem_1fr]',
    large: 'md:grid-cols-[16rem_1fr]',
  }[portraitMedia.presentation.desktopSize];
  const portraitMobileWidth = {
    compact: 'max-w-48',
    standard: 'max-w-64',
    large: 'max-w-full',
  }[portraitMedia.presentation.mobileSize];

  return (
    <CardForgeAppProviders>
      <PublicSiteShell accountSlot={authConfigured ? <ContributorPublicAuthSlot /> : undefined} businessIdentity={businessIdentity} currentPath="/cameron" siteConfiguration={siteConfiguration}>
      <StructuredData value={createFounderProfileStructuredData(businessIdentity)} />
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'Cameron Locke', path: '/cameron' },
      ])} />

      <section className="border-b border-[var(--public-border)] bg-[radial-gradient(circle_at_18%_16%,#30200f_0%,var(--cf-canvas)_42%)] px-5 py-10 md:px-8 md:py-14">
        <div className={`mx-auto grid max-w-5xl gap-8 md:items-center ${portraitDesktopGrid}`}>
          <div
            role="img"
            aria-label={portraitMedia.alt}
            className={`relative grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] bg-cover bg-center font-[var(--public-font-display)] text-5xl text-[var(--public-brass)] shadow-[0_0_40px_rgba(217,164,65,0.1)] md:max-w-none ${portraitMobileWidth}`}
          >
            {portraitUrl ? (
              <ResponsiveSiteMediaImage media={portraitMedia} fill sizes="(min-width: 768px) 256px, 100vw" />
            ) : 'CL'}
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--public-brass)]">{profile.heroEyebrow}</p>
            <h1 className="mt-2 font-[var(--public-font-display)] text-4xl font-semibold text-[var(--public-ivory)] md:text-5xl">{profile.heroHeadline}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">{profile.introduction}</p>
            <div className="mt-6 flex flex-wrap gap-5">
              <Link data-site-content-slug="founder.hero.road-action" href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--public-brass)]">{siteContent['founder.hero.road-action']} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link data-site-content-slug="founder.hero.contact-action" href="/contact" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">{siteContent['founder.hero.contact-action']}</Link>
              {siteConfiguration.supportOfferVisible ? <Link data-site-content-slug="founder.hero.support-action" href="#support" className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">{siteContent['founder.hero.support-action']}</Link> : null}
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
            <h3 data-site-content-slug="founder.current.priorities-heading" className="mt-6 text-lg font-bold text-[var(--public-ivory)]">{siteContent['founder.current.priorities-heading']}</h3>
            <ul className="mt-3 space-y-2 text-base leading-7 text-[var(--public-muted-text)]">
              {profile.priorities.map((priority) => <li key={priority}>• {priority}</li>)}
            </ul>
          </article>
        </div>
      </section>

      {siteConfiguration.supportOfferVisible ? <>
      <section id="support" className="scroll-mt-6 border-b border-[var(--public-border)] bg-[radial-gradient(circle_at_80%_15%,#30200f_0%,var(--cf-canvas)_42%)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl">
          <HeartHandshake className="h-7 w-7 text-[var(--public-brass)]" aria-hidden="true" />
          <p data-site-content-slug="founder.support.eyebrow" className="mt-3 text-base font-semibold text-[var(--public-brass)]">{siteContent['founder.support.eyebrow']}</p>
          <h2 className="mt-2 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-ivory)]">{profile.supportHeading}</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">{profile.supportIntroduction}</p>

          {creatorPlan ? <div className="mt-7 border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
            <h3 className="font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{creatorPlan.displayName}</h3>
            <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">{creatorPlan.description}</p>
            <Link href="/account#account-actions" prefetch={false} className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]">{creatorPlan.ctaLabel}</Link>
          </div> : null}

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
            <div role="status" className="mt-4 border-l-2 border-[var(--public-brass)] bg-[var(--cf-surface-raised)] p-4 text-base font-semibold text-[var(--public-ivory)]">Payments are not active yet. This page explains the separation before payment options are enabled.</div>
          )}
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 data-site-content-slug="founder.support-uses.heading" className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)]">{siteContent['founder.support-uses.heading']}</h2>
          <p data-site-content-slug="founder.support-uses.body" className="mt-3 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">{siteContent['founder.support-uses.body']} {profile.supportUseSummary}</p>
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
      </> : null}
      <Suspense fallback={null}>
        <OwnerPublicSiteControlsSlot currentPath="/cameron" />
      </Suspense>
      </PublicSiteShell>
    </CardForgeAppProviders>
  );
}
