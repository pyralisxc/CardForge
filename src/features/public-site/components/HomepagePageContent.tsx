"use client";

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { McpAllowance } from '@/features/mcp-usage/client/plans';
import type { PublicSiteConfiguration } from '../model/siteConfiguration';
import { isHomepageCustomSection } from '../model/homepageComposition';
import type { SiteMediaAsset } from '../model/siteMedia';
import { AccessComparison } from './AccessComparison';
import { FounderStrip } from './FounderStrip';
import { InteractiveStudioShowcase } from './InteractiveStudioShowcase';
import { OutcomeHero } from './OutcomeHero';
import { WorkflowProof } from './WorkflowProof';
import { HomepageComposedSection } from './HomepageComposedSection';
import { useSiteContent } from './PublicSitePresentationContext';

/** The live homepage and draft canvases render this exact trusted component tree. */
export function HomepagePageContent({ siteConfiguration, siteMedia, plans, founderName }: {
  siteConfiguration: PublicSiteConfiguration; siteMedia: SiteMediaAsset[]; plans: McpAllowance[]; founderName: string;
}) {
  const siteContent = useSiteContent();
  const heroMedia = siteMedia.find((asset) => asset.slot === 'landing.hero');
  const layoutMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.layout');
  const generatorSingleMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.generator-single');
  const generatorBulkMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.generator-bulk');
  const showcaseSection = siteConfiguration.homepageSections.find((section) => section.id === 'showcase');
  const showcaseExamples = showcaseSection && 'showcaseExamples' in showcaseSection ? showcaseSection.showcaseExamples : undefined;
  const showcaseStages = showcaseSection && 'showcaseStages' in showcaseSection ? showcaseSection.showcaseStages : undefined;
  const homepageSections = {
    hero: (<OutcomeHero
          body={siteContent['landing.hero.body']}
          headline={siteContent['landing.hero.headline']}
          media={heroMedia}
          primaryActionHref={siteConfiguration.primaryCtaHref}
          primaryActionLabel={siteConfiguration.primaryCtaLabel}
          secondaryActionLabel={siteContent['landing.hero.secondary-action']}
          support={siteContent['landing.hero.support']}
        />),
    showcase: <InteractiveStudioShowcase layoutMedia={layoutMedia} generatorSingleMedia={generatorSingleMedia} generatorBulkMedia={generatorBulkMedia} mediaAssets={siteMedia} stages={showcaseStages} examples={showcaseExamples} />,
    workflow: <WorkflowProof />,
    access: <AccessComparison plans={plans} />,
    founder: <FounderStrip founderName={founderName} />,
    final_cta: (
      <section className="bg-[radial-gradient(circle_at_center,#2a1a0c_0%,var(--cf-canvas)_62%)] px-5 py-11 text-center md:px-8 md:py-14">
        <div className="mx-auto max-w-3xl">
          <h2 data-site-content-slug="landing.final.headline" className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">{siteContent['landing.final.headline']}</h2>
          <p data-site-content-slug="landing.final.body" className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-[var(--public-muted-text)]">{siteContent['landing.final.body']}</p>
          <Link data-site-configuration-field="primaryCtaLabel" href={siteConfiguration.primaryCtaHref} prefetch={false} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-brass)] px-6 text-base font-bold text-[var(--public-obsidian)] shadow-[var(--public-shadow)] hover:bg-[#f0bd58]">
            {siteConfiguration.primaryCtaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    ),
  } as const;

  return <>{siteConfiguration.homepageSections.filter((section) => section.visible).map((section) => (
    <div key={section.id} data-owner-section-id={section.id}>
      {isHomepageCustomSection(section)
        ? <HomepageComposedSection section={section} media={siteMedia} />
        : homepageSections[section.id]}
    </div>
  ))}</>;
}
