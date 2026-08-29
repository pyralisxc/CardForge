import {
  createDeveloperCockpitErrorResponse,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import { validateCampaignPackage } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    return createNoStoreJsonResponse(
      validateCampaignPackage(await request.json()),
    );
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to validate this campaign package.',
    );
  }
}
