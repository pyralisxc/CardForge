import { getCurrentDeveloperCockpitAccess, requireContributionScope } from '@/features/developer-access/server';
import { createDeveloperCockpitErrorResponse } from '@/features/developer-cockpit/server';
import { getMarketingContributorContext } from '@/features/marketing/server';
import { getMarketingContentWorkspace } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const marketing = await getMarketingContributorContext();
    return createNoStoreJsonResponse({
      campaigns: await getMarketingContentWorkspace(access, {
        marketingStrategy: marketing.strategy,
        marketingCampaigns: marketing.campaigns,
      }),
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to load campaign work.');
  }
}
