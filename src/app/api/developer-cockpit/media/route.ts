import {
  createDeveloperCockpitErrorResponse,
  getAuthorizedCampaignMedia,
  getCurrentDeveloperCockpitAccess,
  ingestCampaignMedia,
  MAX_SOCIAL_MEDIA_BYTES,
  requireContributionScope,
  validateSocialMediaFile,
} from '@/features/developer-cockpit/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const url = new URL(request.url);
    return createNoStoreJsonResponse({ media: await getAuthorizedCampaignMedia(access, { query: url.searchParams.get('query') ?? undefined, state: url.searchParams.get('state') ?? undefined, campaignId: url.searchParams.get('campaignId') ?? undefined }) });
  } catch (error) { return createDeveloperCockpitErrorResponse(error, 'Unable to load campaign media.'); }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess(); requireContributionScope(access, 'campaigns.draft');
    const rateLimit = await consumeRateLimit({ action: 'developer-campaign-media', identity: access.user.id, limit: 30, windowSeconds: 3600 });
    if (!rateLimit.allowed) return createApiErrorResponse(429, 'rate_limited', 'Too many campaign image uploads. Please try again later.');
    const formData = await request.formData(); const file = formData.get('image');
    if (!(file instanceof File)) return createApiErrorResponse(400, 'developer_cockpit_request_invalid', 'Choose a campaign image.');
    const validation = validateSocialMediaFile(file);
    if (!validation.ok) return createApiErrorResponse(file.size > MAX_SOCIAL_MEDIA_BYTES ? 413 : 400, file.size > MAX_SOCIAL_MEDIA_BYTES ? 'payload_too_large' : 'developer_cockpit_request_invalid', validation.message);
    const media = await ingestCampaignMedia({ access, file, idempotencyKey: formData.get('idempotencyKey'), rightsBasis: formData.get('rightsBasis'), creatorCredit: formData.get('creatorCredit'), rightsRestriction: formData.get('rightsRestriction'), rightsExpiresAt: formData.get('rightsExpiresAt'), reusableCaption: formData.get('reusableCaption'), reusableDescription: formData.get('reusableDescription') });
    return createNoStoreJsonResponse({ media, allowedNextActions: ['attach_to_campaign'] }, { status: 201 });
  } catch (error) { return createDeveloperCockpitErrorResponse(error, 'Unable to ingest campaign media.'); }
}
