import {
  createDeveloperCockpitErrorResponse,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import {
  getAuthorizedCampaignMediaPage,
  ingestCampaignMedia,
  MarketingContentStoreError,
  MAX_SOCIAL_MEDIA_BYTES,
  validateSocialMediaFile,
} from '@/features/marketing-content/server';
import {
  createApiErrorResponse,
  createNoStoreJsonResponse,
  createRateLimitErrorResponse,
} from '@/infrastructure/http/apiResponses';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const parseFocalPoint = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new MarketingContentStoreError('Focal point metadata is invalid.', 400);
  }
};

export async function GET(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const url = new URL(request.url);
    const page = await getAuthorizedCampaignMediaPage(access, {
      query: url.searchParams.get('query') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
      campaignId: url.searchParams.get('campaignId') ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 24),
    });
    return createNoStoreJsonResponse({ media: page.items, page });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to load campaign media.',
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const rateLimit = await consumeRateLimit({
      action: 'marketing-content-media',
      identity: access.user.id,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many campaign image uploads.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'campaign_image_uploads',
        maximum: 30,
        unit: 'attempts_per_hour',
      });
    }

    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) {
      return createApiErrorResponse(
        400,
        'developer_cockpit_request_invalid',
        'Choose a campaign image.',
      );
    }

    const validation = validateSocialMediaFile(file);
    if (!validation.ok) {
      const oversized = file.size > MAX_SOCIAL_MEDIA_BYTES;
      return createApiErrorResponse(
        oversized ? 413 : 400,
        oversized ? 'payload_too_large' : 'developer_cockpit_request_invalid',
        validation.message,
      );
    }

    const media = await ingestCampaignMedia({
      access,
      file,
      idempotencyKey: formData.get('idempotencyKey'),
      rightsBasis: formData.get('rightsBasis'),
      creatorCredit: formData.get('creatorCredit'),
      rightsRestriction: formData.get('rightsRestriction'),
      rightsExpiresAt: formData.get('rightsExpiresAt'),
      reusableCaption: formData.get('reusableCaption'),
      reusableDescription: formData.get('reusableDescription'),
      focalPoint: parseFocalPoint(formData.get('focalPoint')),
    });
    return createNoStoreJsonResponse(
      { media, allowedNextActions: ['attach_to_campaign'] },
      { status: 201 },
    );
  } catch (error) {
    return createDeveloperCockpitErrorResponse(
      error,
      'Unable to ingest campaign media.',
    );
  }
}
