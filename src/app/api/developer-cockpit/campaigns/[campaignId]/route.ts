import {
  createDeveloperCockpitErrorResponse,
  DeveloperCockpitStoreError,
  getAllowedCampaignActions,
  getCampaignRecord,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const campaign = await getCampaignRecord((await params).campaignId, access);
    if (!access.isOwner && campaign.contributorId !== access.user.id) {
      throw new DeveloperCockpitStoreError('Campaign package access denied.', 403);
    }
    return createNoStoreJsonResponse({
      campaign,
      allowedNextActions: getAllowedCampaignActions(campaign, access),
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to read the campaign package.',
    );
  }
}
