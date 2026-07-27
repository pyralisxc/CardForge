import {
  approveSocialCampaign,
  cancelSocialCampaign,
  createDeveloperCockpitErrorResponse,
  DeveloperCockpitStoreError,
  createSocialCampaign,
  getCurrentDeveloperCockpitAccess,
  getDeveloperCockpitView,
  requestSocialCampaignChanges,
  requireContributionScope,
  saveSocialCampaign,
  submitSocialCampaign,
} from '@/features/developer-cockpit/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const consumeMutationLimit = async (userId: string) => {
  const rateLimit = await consumeRateLimit({
    action: 'developer-campaign',
    identity: userId,
    limit: 60,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) {
    throw new DeveloperCockpitStoreError('Too many campaign changes. Please try again later.', 429);
  }
};

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    await consumeMutationLimit(access.user.id);
    const body = await request.json() as Parameters<typeof createSocialCampaign>[1];
    await createSocialCampaign(access, body);
    return createNoStoreJsonResponse({
      cockpit: await getDeveloperCockpitView(access),
    }, { status: 201 });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to create the campaign package.');
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    await consumeMutationLimit(access.user.id);
    const body = await request.json() as {
      action?: unknown;
      campaignId?: unknown;
      expectedVersion?: unknown;
      campaign?: Parameters<typeof createSocialCampaign>[1];
      reviewNote?: unknown;
    };
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
    if (body.action === 'save') {
      requireContributionScope(access, 'campaigns.draft');
      await saveSocialCampaign({
        access,
        campaignId,
        expectedVersion: body.expectedVersion,
        input: body.campaign ?? {},
      });
    } else if (body.action === 'submit') {
      requireContributionScope(access, 'campaigns.draft');
      await submitSocialCampaign(access, campaignId, body.expectedVersion);
    } else if (body.action === 'request_changes') {
      requireContributionScope(access, 'campaigns.approve');
      await requestSocialCampaignChanges(
        access,
        campaignId,
        body.expectedVersion,
        body.reviewNote,
      );
    } else if (body.action === 'approve') {
      requireContributionScope(access, 'campaigns.approve');
      await approveSocialCampaign(
        access,
        campaignId,
        body.expectedVersion,
        body.reviewNote,
      );
    } else if (body.action === 'cancel') {
      requireContributionScope(
        access,
        access.isOwner ? 'campaigns.approve' : 'campaigns.draft',
      );
      await cancelSocialCampaign(
        access,
        campaignId,
        body.expectedVersion,
        body.reviewNote,
      );
    } else {
      throw new DeveloperCockpitStoreError('Choose a supported campaign action.', 400);
    }
    return createNoStoreJsonResponse({
      cockpit: await getDeveloperCockpitView(access),
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to update the campaign package.');
  }
}
