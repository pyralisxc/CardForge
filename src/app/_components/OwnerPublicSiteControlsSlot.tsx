import { getCurrentOwnerAccess, getOwnerSiteOperationsPayload } from '@/features/owner/server';
import { OwnerPublicSiteOperations } from '@/features/owner/client';
import { PublicSiteOwnerLiveControls } from '@/features/public-site/client';
import { resolveOwnerPublicationEnvironment } from '@/features/public-site/server';

import { OwnerRoadmapRulesLiveEditor } from './OwnerRoadmapRulesLiveEditor';

export async function OwnerPublicSiteControlsSlot({ currentPath }: { currentPath: string }) {
  const ownerAccess = await getCurrentOwnerAccess();
  if (!ownerAccess.isOwner || !ownerAccess.userId) return null;

  const payload = await getOwnerSiteOperationsPayload();
  const publicationEnvironment = resolveOwnerPublicationEnvironment(process.env.VERCEL_ENV);
  return <PublicSiteOwnerLiveControls
    currentPath={currentPath}
    publicationEnvironment={publicationEnvironment}
    initialBlocks={payload.siteContentBlocks}
    initialMedia={payload.siteMedia}
    initialSiteConfiguration={payload.siteConfiguration}
    siteOperationsEditor={<OwnerPublicSiteOperations />}
    roadmapRulesEditor={currentPath === '/roadmap' ? <OwnerRoadmapRulesLiveEditor initialSettings={payload.siteMechanics} /> : undefined}
  />;
}