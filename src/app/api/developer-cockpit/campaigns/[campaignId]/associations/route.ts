import {
  createDeveloperCockpitErrorResponse,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import { updateCampaignAssociations } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const body = await request.json() as {
      expectedVersion?: unknown;
      associations?: unknown;
    };
    return createNoStoreJsonResponse(await updateCampaignAssociations({
      access,
      campaignId: (await params).campaignId,
      expectedVersion: body.expectedVersion,
      associations: body.associations,
    }));
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to attach development associations.',
    );
  }
}
