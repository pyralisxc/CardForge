import {
  createDeveloperCockpitErrorResponse,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import {
  getAllowedCampaignActions,
  getMarketingContentPackage,
  MarketingContentStoreError,
} from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const campaign = await getMarketingContentPackage((await params).campaignId, access);
    if (!access.isOwner && campaign.contributorId !== access.user.id) {
      throw new MarketingContentStoreError('Marketing content access denied.', 403);
    }
    return createNoStoreJsonResponse({
      campaign,
      allowedNextActions: getAllowedCampaignActions(campaign, access),
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to load the campaign package.',
    );
  }
}
