import {
  DeveloperAssetStoreError,
  getCurrentDeveloperAssetRequestAccess,
  getDeveloperAssetProgramView,
  getDeveloperContributorIds,
  prepareDeveloperAssetUpload,
  removePendingDeveloperAssetUpload,
  requireDeveloperAssetRequestScope,
} from '@/features/developer-assets/server';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const toErrorResponse = (error: unknown, fallback: string) => {
  if (error instanceof SyntaxError) {
    return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  if (error instanceof RateLimitUnavailableError) {
    return createApiErrorResponse(503, 'developer_asset_unavailable', error.message, {
      nextAction: 'Wait for Forge Review services to recover, then retry the upload.',
    });
  }
  if (error instanceof DeveloperAssetStoreError) {
    const code = error.status === 401
      ? 'sign_in_required'
      : error.status === 403
        ? 'developer_access_required'
        : error.status === 503
          ? 'developer_asset_unavailable'
          : error.boundary.kind === 'limit'
            ? 'developer_asset_limit'
            : 'developer_asset_request_invalid';
    return createApiErrorResponse(error.status, code, error.message, {
      kind: error.boundary.kind,
      nextAction: error.boundary.nextAction,
      limit: error.boundary.limit,
    });
  }
  console.error(fallback, error);
  return createApiErrorResponse(500, 'developer_asset_unavailable', fallback);
};

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperAssetRequestAccess();
    requireDeveloperAssetRequestScope(access, 'assets.submit');
    const rateLimit = await consumeRateLimit({
      action: 'developer-upload-plan',
      identity: access.user.id,
      limit: 60,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many Forge Review upload attempts.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        nextAction: 'Wait for the upload window to reset, then try again.',
        resource: 'developer_upload_attempts',
        maximum: 60,
        unit: 'attempts_per_hour',
      });
    }
    const program = await getDeveloperAssetProgramView(
      access.user.id,
      getDeveloperContributorIds(access.user.id),
      { includeRegistryRecipePayloads: access.isOwner },
    );
    if (program.remainingSubmissions <= 0) {
      return createApiErrorResponse(409, 'developer_asset_limit', 'This developer has reached the monthly Forge Review submission allowance.', {
        kind: 'limit',
        nextAction: 'Wait for the next calendar month or ask the owner to raise this developer’s submission allowance.',
        limit: {
          resource: 'developer_monthly_submissions',
          current: program.effectiveMonthlySubmissionLimit,
          maximum: program.effectiveMonthlySubmissionLimit,
          unit: 'submissions_per_month',
        },
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const upload = await prepareDeveloperAssetUpload({
      developerId: access.user.id,
      maxFileSizeMb: program.settings.maxSubmissionFileSizeMb,
      assetType: body.assetType,
      studioDestination: body.studioDestination,
      fileName: body.fileName,
      fileSizeBytes: body.fileSizeBytes,
      mimeType: body.mimeType,
    });
    return createNoStoreJsonResponse({ upload });
  } catch (error) {
    return toErrorResponse(error, 'Unable to prepare the Forge Review source upload.');
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await getCurrentDeveloperAssetRequestAccess();
    requireDeveloperAssetRequestScope(access, 'assets.submit');
    const body = await request.json() as Record<string, unknown>;
    await removePendingDeveloperAssetUpload({
      developerId: access.user.id,
      assetType: body.assetType,
      storagePath: body.storagePath,
    });
    return createNoStoreJsonResponse({ removed: true });
  } catch (error) {
    return toErrorResponse(error, 'Unable to clean up the unfinished Forge Review upload.');
  }
}
