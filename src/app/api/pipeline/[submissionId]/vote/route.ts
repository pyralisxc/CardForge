import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import {
  PipelineStoreError,
  getCurrentPipelineRequestAccess,
  getPipelineVotePolicy,
  projectPipelineProgramForViewer,
  requirePipelineRequestScope,
  voteOnPipelineSubmission,
} from '@/features/pipeline/server';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';
import { revalidateCardForgeCatalog } from '@/features/pipeline/server/catalogCache';

export const dynamic = 'force-dynamic';

const getContributorIds = (userId: string) => [userId];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const access = await getCurrentPipelineRequestAccess();
    requirePipelineRequestScope(access, 'assets.review');

    const rateLimit = await consumeRateLimit({
      action: 'contributor-vote',
      identity: access.user.id,
      limit: 120,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many Contributor votes.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'contributor_votes',
        maximum: 120,
        unit: 'attempts_per_hour',
      });
    }

    const { submissionId } = await params;
    const contributorIds = getContributorIds(access.user.id);
    const votePolicy = await getPipelineVotePolicy(submissionId, {
      viewerId: access.user.id,
      contributor: access.isContributor || access.isOwner,
      owner: access.isOwner,
    });
    if (!votePolicy.submissionStatus) {
      return createApiErrorResponse(404, 'pipeline_request_invalid', 'Pipeline submission was not found.');
    }
    if (!votePolicy.visibleToViewer) {
      return createApiErrorResponse(403, 'pipeline_not_permitted', 'This Pipeline revision is not available to your contributor account.');
    }
    if (
      votePolicy.submissionContributorId
      && contributorIds.includes(votePolicy.submissionContributorId)
      && !votePolicy.allowContributorSelfVoting
    ) {
      return createApiErrorResponse(400, 'pipeline_request_invalid', 'Contributors cannot vote on their own submissions.');
    }

    const body = await request.json() as { voteValue?: unknown };
    const program = await voteOnPipelineSubmission({
      submissionId,
      contributorId: access.user.id,
      voteValue: body.voteValue,
      currentContributorIds: contributorIds,
      ownerContributorId: access.isOwner ? access.user.id : null,
    });
    revalidateCardForgeCatalog();

    return createNoStoreJsonResponse({
      program: projectPipelineProgramForViewer(program, {
        currentUserId: access.user.id,
        isOwner: access.isOwner,
      }),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'pipeline_unavailable', error.message);
    }
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401
          ? 'sign_in_required'
          : error.boundary.code === 'pipeline_not_permitted'
            ? 'pipeline_not_permitted'
            : error.status === 403
              ? 'contributor_access_required'
              : error.status === 503
                ? 'pipeline_unavailable'
                : 'pipeline_request_invalid',
        error.message
      );
    }

    console.error('Failed to submit Pipeline vote:', error);
    return createApiErrorResponse(
      500,
      'pipeline_request_invalid',
      'Unable to submit Pipeline vote.'
    );
  }
}
