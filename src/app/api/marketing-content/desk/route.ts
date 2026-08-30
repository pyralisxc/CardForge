import {
  getCurrentContributorAccess,
  requireContributionScope,
} from '@/features/contributor-access/server';
import { createMarketingContentErrorResponse, getCampaignDeskProjection } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await getCurrentContributorAccess();
    requireContributionScope(access, 'campaigns.draft');
    return createNoStoreJsonResponse({ desk: await getCampaignDeskProjection(access) });
  } catch (error) {
    return createMarketingContentErrorResponse(error, 'Unable to load campaign work for Desk.');
  }
}
