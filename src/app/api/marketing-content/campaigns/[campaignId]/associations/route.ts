import {
  getCurrentContributorAccess,
  requireContributionScope,
} from '@/features/contributor-access/server';
import { createMarketingContentErrorResponse, updateCampaignAssociations } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const access = await getCurrentContributorAccess();
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
    return createMarketingContentErrorResponse(
      error,
      'Unable to update campaign associations.',
    );
  }
}
