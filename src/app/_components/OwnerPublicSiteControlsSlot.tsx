import { getCurrentOwnerAccess, getOwnerSiteOperationsPayload } from '@/features/owner/server';
import { OwnerPublicSiteOperations } from '@/features/owner/client';
import { PublicSiteOwnerLiveControls } from '@/features/public-site/client';

import { OwnerRoadmapRulesLiveEditor } from './OwnerRoadmapRulesLiveEditor';

export async function OwnerPublicSiteControlsSlot({ currentPath }: { currentPath: string }) {
  const ownerAccess = await getCurrentOwnerAccess();
  if (!ownerAccess.isOwner || !ownerAccess.userId) return null;

  const payload = await getOwnerSiteOperationsPayload();
  return <PublicSiteOwnerLiveControls
    currentPath={currentPath}
    initialBlocks={payload.siteContentBlocks}
    initialMedia={payload.siteMedia}
    initialSiteConfiguration={payload.siteConfiguration}
    siteOperationsEditor={currentPath === '/' ? <OwnerPublicSiteOperations /> : undefined}
    roadmapRulesEditor={currentPath === '/roadmap' ? <OwnerRoadmapRulesLiveEditor initialSettings={payload.siteMechanics} /> : undefined}
  />;
}
