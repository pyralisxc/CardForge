import Link from 'next/link';
import {
  ArrowRight,
  Eye,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { ContributorPublicAuthSlot } from '@/features/contributor-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  createBreadcrumbStructuredData,
  createSiteContentMap,
  getCachedPublicSiteConfiguration,
  getCachedSiteContentBlocks,
  ConfiguredPublicSiteShell,
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { OwnerPublicSiteControlsSlot } from '@/app/_components/OwnerPublicSiteControlsSlot';

export async function generateMetadata() {
  const content = createSiteContentMap(await getCachedSiteContentBlocks('about'));
  return createPageMetadata({
    title: content['about.meta.title'],
    description: content['about.meta.description'],
    path: '/about',
  });
}

export default async function AboutPage() {
  const authConfigured = isClerkServerConfigPresent();
  const [businessIdentity, siteContentBlocks, siteConfiguration] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedSiteContentBlocks('about'),
    getCachedPublicSiteConfiguration(),
  ]);
  const siteContent = createSiteContentMap(siteContentBlocks);
  const principles = [
    [siteContent['about.principle1.title'], siteContent['about.principle1.body'], Layers3],
    [siteContent['about.principle2.title'], siteContent['about.principle2.body'], ShieldCheck],
    [siteContent['about.principle3.title'], siteContent['about.principle3.body'], Sparkles],
    [siteContent['about.principle4.title'], siteContent['about.principle4.body'], Eye],
  ] as const;

  return (
    <CardForgeAppProviders>
      <ConfiguredPublicSiteShell accountSlot={authConfigured ? <ContributorPublicAuthSlot /> : undefined} businessIdentity={businessIdentity} currentPath="/about" ownerControls={<OwnerPublicSiteControlsSlot currentPath="/about" />}>
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'About CardForge Studio', path: '/about' },
      ])} />

      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl">
          <p data-site-content-slug="about.hero.eyebrow" className="text-base font-semibold text-[var(--public-brass)]">{siteContent['about.hero.eyebrow']}</p>
          <h1 data-site-content-slug="about.hero.headline" className="mt-2 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-ivory)] md:text-5xl">
            {siteContent['about.hero.headline']}
          </h1>
          <p data-site-content-slug="about.hero.body" className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            {siteContent['about.hero.body']}
          </p>
          <div className="mt-6 flex flex-wrap gap-5">
            <Link href={siteConfiguration.primaryCtaHref} prefetch={false} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--public-brass)]">
              {siteConfiguration.primaryCtaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link data-site-content-slug="about.hero.secondary-action" href="/cameron" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">
              {siteContent['about.hero.secondary-action']}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 data-site-content-slug="about.principles.headline" className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
            {siteContent['about.principles.headline']}
          </h2>
          <p data-site-content-slug="about.principles.body" className="mt-3 max-w-4xl text-lg leading-8 text-[var(--public-muted-text)]">
            {siteContent['about.principles.body']}
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {principles.map(([title, copy, Icon]) => (
              <article key={title} className="border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
                <Icon className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
                <h3 className="mt-3 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{title}</h3>
                <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-surface)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 data-site-content-slug="about.direction.headline" className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
            {siteContent['about.direction.headline']}
          </h2>
          <p data-site-content-slug="about.direction.body" className="mt-3 max-w-4xl text-lg leading-8 text-[var(--public-muted-text)]">
            {siteContent['about.direction.body']}
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="border border-[var(--public-border)] bg-[var(--public-charcoal)] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--public-brass)]">{siteContent['about.direction.current.label']}</p>
              <h3 className="mt-2 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{siteContent['about.direction.current.title']}</h3>
              <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">
                {siteContent['about.direction.current.body']}
              </p>
            </article>
            <article className="border border-[var(--public-border)] bg-[var(--public-charcoal)] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--public-brass)]">{siteContent['about.direction.future.label']}</p>
              <h3 className="mt-2 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{siteContent['about.direction.future.title']}</h3>
              <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">
                {siteContent['about.direction.future.body']}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.3fr_0.7fr] md:items-start">
          <div>
            <h2 data-site-content-slug="about.contributors.headline" className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
              {siteContent['about.contributors.headline']}
            </h2>
            <p data-site-content-slug="about.contributors.body" className="mt-3 text-lg leading-8 text-[var(--public-muted-text)]">
              {siteContent['about.contributors.body']}
            </p>
            <p data-site-content-slug="about.contributors.ownership" className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">
              {siteContent['about.contributors.ownership']}
            </p>
          </div>
          <div className="grid gap-3 border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
            <Link href="/contributors" prefetch={false} className="inline-flex min-h-11 items-center justify-between gap-3 font-bold text-[var(--public-brass)]">
              {siteContent['about.contributors.contributor-action']} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center justify-between gap-3 font-semibold text-[var(--public-ivory)]">
              {siteContent['about.contributors.roadmap-action']} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/cameron" prefetch={false} className="inline-flex min-h-11 items-center justify-between gap-3 font-semibold text-[var(--public-ivory)]">
              {siteContent['about.contributors.founder-action']} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[var(--public-surface)] px-5 py-10 text-[var(--public-ivory)] md:px-8 md:py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 data-site-content-slug="about.beta.headline" className="font-[var(--public-font-display)] text-3xl font-semibold">{siteContent['about.beta.headline']}</h2>
            <p data-site-content-slug="about.beta.body" className="mt-3 max-w-3xl text-base leading-7 text-[var(--public-muted-text)]">
              {siteContent['about.beta.body']}
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/#interactive-showcase" prefetch={false} className="inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]">{siteContent['about.beta.showcase-action']}</Link>
            <Link href="/roadmap" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-[var(--public-ivory)]">{siteContent['about.beta.roadmap-action']}</Link>
          </div>
        </div>
      </section>
      </ConfiguredPublicSiteShell>
    </CardForgeAppProviders>
  );
}
