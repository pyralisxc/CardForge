import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { PublicAuthControls } from '@/features/account/client/auth';
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
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export const metadata = createPageMetadata({
  title: 'Build Complete Card Sets',
  description: 'Create highly customized card sets from reusable layouts and structured data, then review and export the whole set in your browser.',
  path: '/',
});

export default async function LandingPage() {
  const authConfigured = isClerkServerConfigPresent();
  const [businessIdentity, siteMedia, siteContentBlocks, experienceSettings] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedSiteMedia(),
    getCachedSiteContentBlocks('landing'),
    getCachedExperienceSettings(),
  ]);
  const siteContent = createSiteContentMap(siteContentBlocks);
  const heroMedia = siteMedia.find((asset) => asset.slot === 'landing.hero');
  const layoutMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.layout');
  const generatorSingleMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.generator-single');
  const generatorBulkMedia = siteMedia.find((asset) => asset.slot === 'landing.showcase.generator-bulk');

  return (
    <CardForgeAppProviders>
      <PublicSiteShell
        accountSlot={authConfigured ? <PublicAuthControls /> : undefined}
        businessIdentity={businessIdentity}
        currentPath="/"
      >
        <StructuredData value={createCardForgeStructuredData(businessIdentity)} />
        <OutcomeHero
          body={siteContent['landing.hero.body']}
          headline={siteContent['landing.hero.headline']}
          media={heroMedia}
          support={siteContent['landing.hero.support']}
        />
        <InteractiveStudioShowcase
          layoutMedia={layoutMedia}
          generatorSingleMedia={generatorSingleMedia}
          generatorBulkMedia={generatorBulkMedia}
        />
        <WorkflowProof />

        <AccessComparison projectFileAccess={experienceSettings.projectFileAccess} />
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
    </CardForgeAppProviders>
  );
}
