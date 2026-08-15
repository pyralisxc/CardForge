import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Fragment } from 'react';

import { getDeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
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
  getCachedSiteMedia,
  getCachedPublicSiteConfiguration,
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export async function generateMetadata() {
  const siteConfiguration = await getCachedPublicSiteConfiguration();
  return createPageMetadata({
    title: siteConfiguration.homepageTitle,
    description: siteConfiguration.homepageDescription,
    path: '/',
  });
}

export default async function LandingPage() {
  const authConfigured = isClerkServerConfigPresent();
  const [businessIdentity, siteMedia, siteContentBlocks, experienceSettings, siteConfiguration] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedSiteMedia(),
    getCachedSiteContentBlocks('landing'),
    getCachedExperienceSettings(),
    getCachedPublicSiteConfiguration(),
  ]);
  const siteContent = createSiteContentMap(siteContentBlocks);
  const heroMedia = siteMedia.find((asset) => asset.slot === 'landing.hero');
  const layoutMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.layout');
  const generatorSingleMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.generator-single');
  const generatorBulkMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.generator-bulk');
  const homepageSections = {
    showcase: <InteractiveStudioShowcase layoutMedia={layoutMedia} generatorSingleMedia={generatorSingleMedia} generatorBulkMedia={generatorBulkMedia} />,
    workflow: <WorkflowProof />,
    access: <AccessComparison projectFileAccess={experienceSettings.projectFileAccess} creatorPassVisible={siteConfiguration.creatorPassOfferVisible} />,
    founder: <FounderStrip founderName={businessIdentity.legalOperatorName} />,
    final_cta: (
      <section className="bg-[radial-gradient(circle_at_center,#2a1a0c_0%,#0c0b09_62%)] px-5 py-11 text-center md:px-8 md:py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">{siteContent['landing.final.headline']}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-[var(--public-muted-text)]">{siteContent['landing.final.body']}</p>
          <Link href={siteConfiguration.primaryCtaHref} prefetch={false} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-brass)] px-6 text-base font-bold text-[var(--public-obsidian)] shadow-[var(--public-shadow)] hover:bg-[#f0bd58]">
            {siteConfiguration.primaryCtaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    ),
  } as const;

  return (
    <CardForgeAppProviders>
      <PublicSiteShell
        accountSlot={authConfigured ? await getDeveloperPublicAuthSlot() : undefined}
        businessIdentity={businessIdentity}
        currentPath="/"
        siteConfiguration={siteConfiguration}
      >
        <StructuredData value={createCardForgeStructuredData(
          businessIdentity,
          siteMedia.find((asset) => asset.slot === 'brand.mark'),
        )} />
        <OutcomeHero
          body={siteContent['landing.hero.body']}
          headline={siteContent['landing.hero.headline']}
          media={heroMedia}
          primaryActionHref={siteConfiguration.primaryCtaHref}
          primaryActionLabel={siteConfiguration.primaryCtaLabel}
          secondaryActionLabel={siteContent['landing.hero.secondary-action']}
          support={siteContent['landing.hero.support']}
        />
        {siteConfiguration.homepageSections.filter((section) => section.visible).map((section) => (
          <Fragment key={section.id}>{homepageSections[section.id]}</Fragment>
        ))}
      </PublicSiteShell>
    </CardForgeAppProviders>
  );
}
