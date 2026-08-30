import { getCurrentContributorAccess, requireContributionScope } from '@/features/contributor-access/server';
import { createMarketingContentErrorResponse } from '@/features/marketing-content/server';
import { getMarketingContributorContext } from '@/features/marketing/server';
import { getMarketingContentWorkspace } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await getCurrentContributorAccess();
    requireContributionScope(access, 'campaigns.draft');
    const marketing = await getMarketingContributorContext();
    return createNoStoreJsonResponse({
      campaigns: await getMarketingContentWorkspace(access, {
        marketingStrategy: marketing.strategy,
        marketingCampaigns: marketing.campaigns,
      }),
    });
  } catch (error) {
    return createMarketingContentErrorResponse(error, 'Unable to load campaign work.');
  }
}
