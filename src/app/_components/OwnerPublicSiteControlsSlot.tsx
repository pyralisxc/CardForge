import { getCurrentOwnerAccess } from '@/features/owner/server';
import { OwnerPublicSiteOperations } from '@/features/owner/client';
import { PublicSiteOwnerLiveControls } from '@/features/public-site/client';
import {
  getPublicSiteConfiguration,
  getSiteContentBlocks,
  getSiteMedia,
  resolveOwnerPublicationEnvironment,
} from '@/features/public-site/server';
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

  const [siteContentBlocks, siteMedia, siteConfiguration, roadmapSettings] = await Promise.all([
    getSiteContentBlocks(),
    getSiteMedia(),
    getPublicSiteConfiguration(),
    currentPath === '/roadmap' ? getRoadmapSettings() : Promise.resolve(null),
  ]);
  const publicationEnvironment = resolveOwnerPublicationEnvironment(process.env.VERCEL_ENV);
  return <PublicSiteOwnerLiveControls
    currentPath={currentPath}
    publicationEnvironment={publicationEnvironment}
    initialBlocks={siteContentBlocks}
    initialMedia={siteMedia}
    initialSiteConfiguration={siteConfiguration}
    siteOperationsEditor={<OwnerPublicSiteOperations />}
    roadmapRulesEditor={roadmapSettings ? <OwnerRoadmapRulesLiveEditor initialSettings={roadmapSettings} /> : undefined}
  />;
}
