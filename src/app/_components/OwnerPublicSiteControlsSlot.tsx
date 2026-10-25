import { getCurrentOwnerAccess } from '@/features/owner/server';
import { OwnerPublicSiteOperations } from '@/features/owner/client';
import { PublicSiteOwnerLiveControls } from '@/features/public-site/client';
import {
  completeSiteMediaForSections,
  getSiteCompositionSections,
  resolveOwnerPublicationEnvironment,
} from '@/features/public-site/server';
import { resolveLiveWebsitePresentation } from '@/features/public-site/server/websitePresentationResolver';
import { readLiveWebsiteRevision, readWebsiteRevisionIdentity, readWebsiteRevision } from '@/features/public-site/server/websiteEditionStore';
import { getRoadmapSettings } from '@/features/roadmap/server';

import { OwnerRoadmapRulesLiveEditor } from './OwnerRoadmapRulesLiveEditor';

/**
 * The public page needs only its actual content/media/configuration to edit.
 * Unrelated Owner domains load from the protected site endpoint if/when the
 * Owner opens Site settings, not on every public-page render.
 */
export async function OwnerPublicSiteControlsSlot({ currentPath }: { currentPath: string }) {
  const ownerAccess = await getCurrentOwnerAccess();
  if (!ownerAccess.isOwner || !ownerAccess.userId) return null;

  const [presentation, live, roadmapSettings] = await Promise.all([
    resolveLiveWebsitePresentation(),
    readLiveWebsiteRevision(),
    currentPath === '/roadmap' ? getRoadmapSettings() : Promise.resolve(null),
  ]);
  const { content: siteContentBlocks, media: siteMedia, configuration: siteConfiguration } = presentation;
  const editionIdentity = presentation.revisionId
    ? await readWebsiteRevisionIdentity(presentation.revisionId) : null;
  const editionSession = editionIdentity && presentation.revisionId ? {
    editionId: editionIdentity.editionId, revisionId: presentation.revisionId,
    liveGeneration: live.generation, manifest: await readWebsiteRevision(presentation.revisionId),
  } : null;
  const publicationEnvironment = resolveOwnerPublicationEnvironment(process.env.VERCEL_ENV);
  return <PublicSiteOwnerLiveControls
    currentPath={currentPath}
    publicationEnvironment={publicationEnvironment}
    initialBlocks={siteContentBlocks}
    initialMedia={completeSiteMediaForSections(siteMedia, getSiteCompositionSections(siteConfiguration))}
    initialSiteConfiguration={siteConfiguration}
    editionSession={editionSession}
    siteOperationsEditor={<OwnerPublicSiteOperations publicationEnvironment={publicationEnvironment} currentPath={currentPath} />}
    roadmapRulesEditor={roadmapSettings ? <OwnerRoadmapRulesLiveEditor initialSettings={roadmapSettings} /> : undefined}
  />;
}
