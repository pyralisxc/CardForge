import {
  createDeveloperCockpitErrorResponse,
  DeveloperCockpitStoreError,
  getBufferChannels,
  getCurrentDeveloperCockpitAccess,
  getDeveloperCockpitView,
  publishSocialCampaignToBuffer,
  refreshSocialCampaignProviderStatus,
  requireContributionScope,
  type ProviderChannelBinding,
} from '@/features/developer-cockpit/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.publish');
    return createNoStoreJsonResponse({ channels: await getBufferChannels() });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to load Buffer channels.');
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.publish');
    const rateLimit = await consumeRateLimit({
      action: 'social-publishing',
      identity: access.user.id,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      throw new DeveloperCockpitStoreError('Too many provider publishing actions. Please try again later.', 429);
    }
    const body = await request.json() as {
      action?: unknown;
      campaignId?: unknown;
      expectedVersion?: unknown;
      mode?: unknown;
      dueAt?: unknown;
      bindings?: ProviderChannelBinding[];
    };
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
    if (body.action === 'publish' && (body.mode === 'draft' || body.mode === 'schedule')) {
      await publishSocialCampaignToBuffer({
        access,
        campaignId,
        expectedVersion: body.expectedVersion,
        mode: body.mode,
        dueAt: body.dueAt,
        bindings: Array.isArray(body.bindings) ? body.bindings : [],
      });
    } else if (body.action === 'refresh') {
      await refreshSocialCampaignProviderStatus(access, campaignId);
    } else {
      throw new DeveloperCockpitStoreError('Choose a supported provider action.', 400);
    }
    return createNoStoreJsonResponse({
      cockpit: await getDeveloperCockpitView(access),
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to update Buffer publishing.');
  }
}
