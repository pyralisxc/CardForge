import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import {
  DeveloperAssetStoreError,
  getCurrentDeveloperAssetRequestAccess,
  getDeveloperAssetVotePolicy,
  projectDeveloperAssetProgramForViewer,
  requireDeveloperAssetRequestScope,
  voteOnDeveloperAssetSubmission,
} from '@/features/developer-assets/server';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';
import { revalidateCardForgeCatalog } from '@/features/developer-assets/server/catalogCache';

export const dynamic = 'force-dynamic';

const getContributorIds = (userId: string) => [userId];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const access = await getCurrentDeveloperAssetRequestAccess();
    requireDeveloperAssetRequestScope(access, 'assets.review');

    const rateLimit = await consumeRateLimit({
      action: 'developer-vote',
      identity: access.user.id,
      limit: 120,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many developer votes.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'developer_votes',
        maximum: 120,
        unit: 'attempts_per_hour',
      });
    }

    const { submissionId } = await params;
    const contributorIds = getContributorIds(access.user.id);
    const votePolicy = await getDeveloperAssetVotePolicy(submissionId, {
      viewerId: access.user.id,
      contributor: access.isDeveloper || access.isOwner,
      owner: access.isOwner,
    });
    if (!votePolicy.submissionStatus) {
      return createApiErrorResponse(404, 'developer_asset_request_invalid', 'Developer asset submission was not found.');
    }
    if (!votePolicy.visibleToViewer) {
      return createApiErrorResponse(403, 'developer_asset_not_permitted', 'This Pipeline revision is not available to your contributor account.');
    }
    if (
      votePolicy.submissionDeveloperId
      && contributorIds.includes(votePolicy.submissionDeveloperId)
      && !votePolicy.allowContributorSelfVoting
    ) {
      return createApiErrorResponse(400, 'developer_asset_request_invalid', 'Developers cannot vote on their own submissions.');
    }

    const body = await request.json() as { voteValue?: unknown };
    const program = await voteOnDeveloperAssetSubmission({
      submissionId,
      developerId: access.user.id,
      voteValue: body.voteValue,
      currentContributorIds: contributorIds,
      ownerDeveloperId: access.isOwner ? access.user.id : null,
    });
    revalidateCardForgeCatalog();

    return createNoStoreJsonResponse({
      program: projectDeveloperAssetProgramForViewer(program, {
        currentUserId: access.user.id,
        isOwner: access.isOwner,
      }),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'developer_asset_unavailable', error.message);
    }
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401
          ? 'sign_in_required'
          : error.boundary.code === 'developer_asset_not_permitted'
            ? 'developer_asset_not_permitted'
            : error.status === 403
              ? 'developer_access_required'
              : error.status === 503
                ? 'developer_asset_unavailable'
                : 'developer_asset_request_invalid',
        error.message
      );
    }

    console.error('Failed to submit developer asset vote:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to submit developer asset vote.'
    );
  }
}
