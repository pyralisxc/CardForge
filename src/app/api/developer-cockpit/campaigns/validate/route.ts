import { createDeveloperCockpitErrorResponse, getCurrentDeveloperCockpitAccess, requireContributionScope, validateCampaignPackage } from '@/features/developer-cockpit/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { try { const access = await getCurrentDeveloperCockpitAccess(); requireContributionScope(access, 'campaigns.draft'); return createNoStoreJsonResponse(validateCampaignPackage(await request.json(), access)); } catch (error) { return createDeveloperCockpitErrorResponse(error, 'Unable to validate the campaign package.'); } }
