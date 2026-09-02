import { getCurrentOwnerAccess, getOwnerSiteConsolePayload } from '@/features/owner/server';
import { PublicSiteOwnerLiveControls } from '@/features/public-site/client';

import { OwnerRoadmapRulesLiveEditor } from './OwnerRoadmapRulesLiveEditor';

export async function OwnerPublicSiteControlsSlot({ currentPath }: { currentPath: string }) {
  const ownerAccess = await getCurrentOwnerAccess();
  if (!ownerAccess.isOwner || !ownerAccess.userId) return null;

  const payload = await getOwnerSiteConsolePayload();
  return <PublicSiteOwnerLiveControls
    currentPath={currentPath}
    initialBlocks={payload.siteContentBlocks}
    initialMedia={payload.siteMedia}
    initialSiteConfiguration={payload.siteConfiguration}
    roadmapRulesEditor={currentPath === '/roadmap' ? <OwnerRoadmapRulesLiveEditor initialSettings={payload.siteMechanics} /> : undefined}
  />;
}
