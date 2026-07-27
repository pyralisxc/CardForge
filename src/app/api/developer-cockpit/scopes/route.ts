import {
  createDeveloperCockpitErrorResponse,
  getCurrentDeveloperCockpitAccess,
  getDeveloperCockpitView,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import { updateDeveloperContributionScopes } from '@/features/developer-access/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'scopes.manage');
    const body = await request.json() as {
      developerId?: unknown;
      canDraftCampaigns?: unknown;
      canProposeSiteContent?: unknown;
    };
    await updateDeveloperContributionScopes({
      developerId: body.developerId,
      canDraftCampaigns: body.canDraftCampaigns,
      canProposeSiteContent: body.canProposeSiteContent,
    });
    return createNoStoreJsonResponse({
      cockpit: await getDeveloperCockpitView(access),
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to update contribution scopes.');
  }
}
