import {
  getCurrentContributorAccess,
  requireContributionScope,
} from '@/features/contributor-access/server';
import {
  createMarketingContentErrorResponse,
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
    const access = await getCurrentContributorAccess();
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
    return createMarketingContentErrorResponse(
      error,
      'Unable to load the campaign package.',
    );
  }
}
