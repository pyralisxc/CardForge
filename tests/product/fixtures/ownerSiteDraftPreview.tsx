import { DEFAULT_SITE_CONTENT_BLOCKS } from '@/features/public-site/model/siteContent';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PublicSiteOwnerLiveControls, WebsiteEditionDraftContext } from '@/features/public-site/components/PublicSiteOwnerLiveControls';
import { OwnerSiteConfigurationPanel } from '@/features/owner/components/OwnerSiteConfigurationPanel';
import { useContext } from 'react';
import { PublicSiteShell } from '@/features/public-site/components/PublicSiteShell';
import { createRoot } from 'react-dom/client';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { OwnerSiteDraftPreview } from '@/features/owner/components/OwnerSiteDraftPreview';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/model/siteConfiguration';
import { DEFAULT_BUSINESS_IDENTITY } from '@/features/business-identity/model/businessIdentity';
import type { PublicSitePage } from '@/features/public-site/model/sitePages';

const page: PublicSitePage = { id: 'page-proof', slug: 'proof', title: 'Curated website preview',
  description: 'This isolated component fixture contains no personal workspace or account content.', keywords: ['proof'], published: false,
  sections: [{ id: 'custom-proof', kind: 'custom', visible: true,
    design: { layout: 'split', tone: 'raised', spacing: 'balanced', align: 'start' },
    blocks: [{ id: 'block-title', kind: 'heading', text: 'A reusable first-party page' },
      { id: 'block-body', kind: 'text', text: 'The live page and draft share one trusted renderer.' }] }],
};
const target = document.createElement('div');
target.dataset.ownerPreviewFixture = 'true';
document.body.appendChild(target);
const unavailable = () => { throw new Error('Navigation/publication is outside this presentation fixture'); };
const router: AppRouterInstance = { back: unavailable, forward: unavailable, refresh: unavailable,
  push: unavailable, replace: unavailable, prefetch: () => {}, bfcacheId: 'owner-controls-proof' };
const inlineCopy = { ...DEFAULT_SITE_CONTENT_BLOCKS.find(block => block.slug === 'landing.hero.headline')!, body: 'Synthetic headline for local inline cancellation.' };
const FixtureSettings = () => {
  const edition = useContext(WebsiteEditionDraftContext);
  return <OwnerSiteConfigurationPanel settings={edition?.configuration ?? DEFAULT_PUBLIC_SITE_CONFIGURATION}
    onSettingsChange={() => {}} onStage={edition?.stageConfiguration}
    publicationEnvironment="preview" />;
};
const controls = <AppRouterContext.Provider value={router}>
  <PublicSiteShell businessIdentity={DEFAULT_BUSINESS_IDENTITY} siteConfiguration={DEFAULT_PUBLIC_SITE_CONFIGURATION} currentPath="/">
    <h1>Isolated saved edition controls</h1>
    <p data-site-content-slug={inlineCopy.slug}>{inlineCopy.body}</p>
    <PublicSiteOwnerLiveControls currentPath="/" publicationEnvironment="preview" initialBlocks={[inlineCopy]} initialMedia={[]}
      initialSiteConfiguration={DEFAULT_PUBLIC_SITE_CONFIGURATION}
      editionSession={{ editionId: 'edition-proof', revisionId: 'revision-proof-2', liveGeneration: 1,
        manifest: { schemaVersion: 1, configuration: DEFAULT_PUBLIC_SITE_CONFIGURATION, content: [{ slug: inlineCopy.slug, body: inlineCopy.body }], media: [] } }} siteOperationsEditor={<FixtureSettings />} />
  </PublicSiteShell>
</AppRouterContext.Provider>;
createRoot(target).render(window.location.pathname === '/__owner-controls-proof' ? controls : <Sheet defaultOpen><SheetContent className="w-[min(100vw,42rem)] max-w-[42rem] overflow-auto sm:max-w-[42rem]" aria-describedby="owner-preview-proof-description">
  <SheetTitle>Isolated Owner preview proof</SheetTitle>
  <SheetDescription id="owner-preview-proof-description">Test presentation only; no Owner authority or publication API is connected.</SheetDescription>
  <OwnerSiteDraftPreview settings={{ ...DEFAULT_PUBLIC_SITE_CONFIGURATION, pages: [page] }} page={page} media={[]} businessIdentity={DEFAULT_BUSINESS_IDENTITY} plans={[]} />
</SheetContent></Sheet>);
