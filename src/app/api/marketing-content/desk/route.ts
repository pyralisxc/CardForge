import {
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-access/server';
import { createDeveloperCockpitErrorResponse } from '@/features/developer-cockpit/server';
import { getCampaignDeskProjection } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    return createNoStoreJsonResponse({ desk: await getCampaignDeskProjection(access) });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to load campaign work for Desk.');
  }
}
