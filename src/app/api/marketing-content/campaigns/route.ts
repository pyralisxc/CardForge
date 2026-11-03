import {
  getCurrentContributorAccess,
  requireContributionScope,
} from '@/features/contributor-access/server';
import {
  createMarketingContentErrorResponse,
  approveSocialCampaign,
  cancelSocialCampaign,
  MarketingContentStoreError,
  requestSocialCampaignChanges,
  submitSocialCampaign,
} from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCurrentAccountToolAccess } from '@/features/account/server';
import { listCampaignDrafts, createCampaignDraft, saveCampaignDraft, consumeCampaignMutationLimit } from '@/features/marketing-content/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await getCurrentAccountToolAccess();
    const url = new URL(request.url);
    return createNoStoreJsonResponse(await listCampaignDrafts(access.user.id, {
      cursor: Math.max(0, Number(url.searchParams.get('cursor') ?? 0) || 0),
      limit: Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 25) || 25)),
      ...(url.searchParams.has('status') ? { status: url.searchParams.get('status') } : {}),
    }));
  } catch (error) {
    return createMarketingContentErrorResponse(
      error,
      'Unable to list campaign packages.',
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentAccountToolAccess();
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MarketingContentStoreError('Provide a Campaign draft object.', 400);
    const { idempotencyKey, ...campaign } = body;
    const result = await createCampaignDraft(access.user.id, { idempotencyKey, campaign });
    return draftResponse(result, 201);
  } catch (error) {
    return createMarketingContentErrorResponse(
      error,
      'Unable to create the campaign package.',
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      action?: unknown;
      campaignId?: unknown;
      expectedVersion?: unknown;
      campaign?: Record<string, unknown>;
      reviewNote?: unknown;
    };
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MarketingContentStoreError('Provide a Campaign command object.', 400);
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';

    if (body.action === 'save') {
      const account = await getCurrentAccountToolAccess();
      // Browser draft payload carries its creation key; Save is bound only to exact ID/version.
      const { idempotencyKey: ignoredKey, ...campaign } = body.campaign ?? {} as Record<string, unknown>;
      void ignoredKey;
      return draftResponse(await saveCampaignDraft(account.user.id, { campaignId, expectedVersion: body.expectedVersion, campaign }));
    }
    const access = await getCurrentContributorAccess();
    await consumeCampaignMutationLimit(access.user.id);
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
    return createMarketingContentErrorResponse(
      error,
      'Unable to update the campaign package.',
    );
  }
}

async function draftResponse(result: Awaited<ReturnType<typeof createCampaignDraft>>, status = 200) {
  if (result.receipt.outcome === 'uncertain') {
    const unavailable = createMarketingContentErrorResponse(new MarketingContentStoreError(result.receipt.warnings.join(' '), 503), 'Campaign outcome is unconfirmed.');
    const body = await unavailable.json();
    return createNoStoreJsonResponse({ ...body, error: { ...body.error, retryable: false, nextAction: 'Read exact campaign or actor/key receipt; do not replay automatically.' }, ...result }, { status: 503, headers: unavailable.headers });
  }
  return createNoStoreJsonResponse(result, { status });
}
