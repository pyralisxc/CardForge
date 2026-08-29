import {
  createDeveloperCockpitErrorResponse,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import {
  approveSocialCampaign,
  cancelSocialCampaign,
  createSocialCampaign,
  listSocialCampaigns,
  MarketingContentStoreError,
  requestSocialCampaignChanges,
  saveSocialCampaign,
  submitSocialCampaign,
} from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitExceededError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const consumeMutationLimit = async (userId: string) => {
  const rateLimit = await consumeRateLimit({
    action: 'marketing-content-campaign',
    identity: userId,
    limit: 60,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) {
    throw new RateLimitExceededError(
      'Too many campaign changes.',
      rateLimit.retryAfterSeconds,
      { resource: 'campaign_changes', maximum: 60, unit: 'attempts_per_hour' },
    );
  }
};

export async function GET(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const url = new URL(request.url);
    const cursor = Math.max(0, Number(url.searchParams.get('cursor') ?? 0) || 0);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('limit') ?? 25) || 25),
    );
    return createNoStoreJsonResponse(await listSocialCampaigns({
      access,
      status: url.searchParams.get('status') ?? undefined,
      cursor,
      limit,
    }));
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to list campaign packages.',
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    await consumeMutationLimit(access.user.id);
    const body = await request.json() as Parameters<typeof createSocialCampaign>[1];
    return createNoStoreJsonResponse(
      await createSocialCampaign(access, body),
      { status: 201 },
    );
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to create the campaign package.',
    );
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
      return createNoStoreJsonResponse(await saveSocialCampaign({
        access,
        campaignId,
        expectedVersion: body.expectedVersion,
        input: body.campaign ?? {},
      }));
    }
    if (body.action === 'submit') {
      requireContributionScope(access, 'campaigns.draft');
      return createNoStoreJsonResponse(await submitSocialCampaign(
        access,
        campaignId,
        body.expectedVersion,
      ));
    }
    if (body.action === 'request_changes') {
      requireContributionScope(access, 'campaigns.approve');
      return createNoStoreJsonResponse(await requestSocialCampaignChanges(
        access,
        campaignId,
        body.expectedVersion,
        body.reviewNote,
      ));
    }
    if (body.action === 'approve') {
      requireContributionScope(access, 'campaigns.approve');
      return createNoStoreJsonResponse(await approveSocialCampaign(
        access,
        campaignId,
        body.expectedVersion,
        body.reviewNote,
      ));
    }
    if (body.action === 'cancel') {
      requireContributionScope(
        access,
        access.isOwner ? 'campaigns.approve' : 'campaigns.draft',
      );
      return createNoStoreJsonResponse(await cancelSocialCampaign(
        access,
        campaignId,
        body.expectedVersion,
        body.reviewNote,
      ));
    }

    throw new MarketingContentStoreError(
      'Choose a supported campaign action.',
      400,
    );
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to update the campaign package.',
    );
  }
}
