import {
  getCurrentContributorAccess,
  requireContributionScope,
} from '@/features/contributor-access/server';
import { createMarketingContentErrorResponse, validateCampaignPackage } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const access = await getCurrentContributorAccess();
    requireContributionScope(access, 'campaigns.draft');
    return createNoStoreJsonResponse(
      validateCampaignPackage(await request.json()),
    );
  } catch (error) {
    return createMarketingContentErrorResponse(
      error,
      'Unable to validate this campaign package.',
    );
  }
}
