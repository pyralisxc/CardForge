import { createDeveloperCockpitErrorResponse } from '@/features/developer-cockpit/server/apiError';
import {
  getCurrentDeveloperCockpitAccess,
  getDeveloperCampaignWorkspace,
  getDeveloperCockpitBootstrap,
  getDeveloperSiteWorkspace,
} from '@/features/developer-cockpit/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    const scope = new URL(request.url).searchParams.get('scope');
    if (!scope) {
      return createNoStoreJsonResponse({ cockpit: await getDeveloperCockpitBootstrap(access) });
    }
    if (scope === 'campaigns') {
      return createNoStoreJsonResponse({ campaigns: await getDeveloperCampaignWorkspace(access) });
    }
    if (scope === 'site') {
      return createNoStoreJsonResponse({ site: await getDeveloperSiteWorkspace(access) });
    }
    return createApiErrorResponse(400, 'developer_cockpit_request_invalid', 'Unknown developer cockpit scope.');
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to load the developer cockpit.');
  }
}
