import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import {
  completeManualMarketingDelivery,
  getMarketingCommandCenterView,
  MarketingStoreError,
  queueMarketingDelivery,
  saveMarketingCampaign,
  saveMarketingDestination,
  updateMarketingStrategy,
} from '@/features/marketing/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const requireOwner = async () => {
  const owner = await getCurrentOwnerAccess();
  return owner.isOwner && owner.userId ? owner : null;
};

const errorResponse = (error: unknown) => {
  if (error instanceof SyntaxError) {
    return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  if (error instanceof MarketingStoreError) {
    return createApiErrorResponse(error.status, 'marketing_command_failed', error.message);
  }
  console.error('Marketing command center request failed:', error);
  return createApiErrorResponse(500, 'marketing_command_unavailable', 'The marketing command center is unavailable.');
};

export async function GET() {
  const owner = await requireOwner();
  if (!owner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  try {
    return createNoStoreJsonResponse({ marketing: await getMarketingCommandCenterView() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (!owner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  try {
    const body = await request.json() as Record<string, unknown>;
    let result: unknown;
    let activity: { action: string; targetType: string; targetId: string; summary: string };
    if (body.action === 'update_strategy') {
      result = { strategy: await updateMarketingStrategy(
        owner.userId!,
        body.expectedVersion,
        (body.strategy ?? {}) as Record<string, unknown>,
      ) };
      activity = { action: 'marketing.strategy.update', targetType: 'marketing_strategy', targetId: 'cardforge', summary: 'Updated the CardForge marketing strategy and claims guardrails.' };
    } else if (body.action === 'save_campaign') {
      const campaign = await saveMarketingCampaign(
        owner.userId!,
        (body.campaign ?? {}) as Record<string, unknown>,
        typeof body.campaignId === 'string' ? body.campaignId : undefined,
        body.expectedVersion,
      );
      result = { campaign };
      activity = { action: 'marketing.campaign.save', targetType: 'marketing_campaign', targetId: campaign.id, summary: `Saved marketing campaign “${campaign.name}”.` };
    } else if (body.action === 'save_destination') {
      const destination = await saveMarketingDestination(
        owner.userId!,
        (body.destination ?? {}) as Record<string, unknown>,
        typeof body.destinationId === 'string' ? body.destinationId : undefined,
      );
      result = { destination };
      activity = { action: 'marketing.destination.save', targetType: 'marketing_destination', targetId: destination.id, summary: `Saved marketing destination “${destination.name}”.` };
    } else if (body.action === 'queue_delivery') {
      const delivery = await queueMarketingDelivery({
        contentId: typeof body.contentId === 'string' ? body.contentId : '',
        destinationId: typeof body.destinationId === 'string' ? body.destinationId : '',
        scheduledFor: body.scheduledFor,
      });
      result = { delivery };
      activity = { action: 'marketing.delivery.queue', targetType: 'marketing_delivery', targetId: delivery.id, summary: 'Prepared approved marketing content for a destination.' };
    } else if (body.action === 'complete_manual_delivery') {
      const delivery = await completeManualMarketingDelivery(
        typeof body.deliveryId === 'string' ? body.deliveryId : '',
        body.publicationUrl,
        body.manualNote,
      );
      result = { delivery };
      activity = { action: 'marketing.delivery.publish', targetType: 'marketing_delivery', targetId: delivery.id, summary: 'Recorded a completed manual marketing publication.' };
    } else {
      throw new MarketingStoreError('Choose a supported marketing action.', 400);
    }
    const activityRecorded = await recordOwnerActivity({
      actorUserId: owner.userId!,
      actorEmail: owner.email,
      ...activity,
      metadata: {},
    });
    return createNoStoreJsonResponse({ ...result as object, activityRecorded });
  } catch (error) {
    return errorResponse(error);
  }
}
