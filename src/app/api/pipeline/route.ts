import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import {
  createUploadedPipelineSubmission,
  PipelineStoreError,
  getCurrentPipelineRequestAccess,
  getPipelineContributorIds,
  getPipelineProgramView,
  getPipelineContributorSummary,
  projectPipelineProgramForViewer,
  requirePipelineRequestScope,
  updateContributorProfileOverrides,
  updatePipelineProgramSettings,
} from '@/features/pipeline/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createServerTimingTracker } from '@/infrastructure/http/serverTiming';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';
import { revalidateCardForgeCatalog } from '@/features/pipeline/server/catalogCache';

export const dynamic = 'force-dynamic';

const getOwnerAccess = async () => {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) {
    return {
      ok: false as const,
      response: createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for Contributor program settings.'),
    };
  }
  return { ok: true as const, owner };
};

const parsePositiveInteger = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export async function GET(request: Request) {
  const timing = createServerTimingTracker();
  try {
    const access = await timing.track('developer_access', getCurrentPipelineRequestAccess);
    requirePipelineRequestScope(access, 'assets.review');
    const url = new URL(request.url);
    const program = await timing.track(
      'program_view',
      () => getPipelineProgramView(
        access.user.id,
        getPipelineContributorIds(access.user.id),
        {
          includeRegistryRecipePayloads: access.isOwner,
          submissionQuery: {
            scope: access.isOwner ? 'all' : 'own',
            query: url.searchParams.get('query') ?? '',
            assetType: url.searchParams.get('assetType') ?? 'all',
            status: url.searchParams.get('status') ?? 'all',
            page: parsePositiveInteger(url.searchParams.get('page'), 1),
            pageSize: parsePositiveInteger(url.searchParams.get('pageSize'), 12),
          },
          votingQuery: {
            scope: 'review',
            query: url.searchParams.get('reviewQuery') ?? '',
            assetType: url.searchParams.get('reviewAssetType') ?? 'all',
            status: url.searchParams.get('reviewStatus') ?? 'all',
            tier: url.searchParams.get('reviewTier') ?? 'all',
            voteFilter: url.searchParams.get('reviewVote') ?? 'all',
            page: parsePositiveInteger(url.searchParams.get('reviewPage'), 1),
            pageSize: parsePositiveInteger(url.searchParams.get('reviewPageSize'), 10),
          },
        },
      ),
    );

    const response = createNoStoreJsonResponse({
      ownerAccess: access.ownerAccess,
      isContributor: access.isContributor,
      isOwner: access.isOwner,
      program: projectPipelineProgramForViewer(program, {
        currentUserId: access.user.id,
        isOwner: access.isOwner,
      }),
    });
    response.headers.set('Server-Timing', timing.header());
    return response;
  } catch (error) {
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : error.status === 403 ? 'contributor_access_required' : 'pipeline_unavailable',
        error.message,
      );
    }
    console.error('Failed to load Pipeline program:', error);
    return createApiErrorResponse(
      500,
      'pipeline_unavailable',
      'Unable to load Pipeline program.'
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentPipelineRequestAccess();
    requirePipelineRequestScope(access, 'assets.submit');
    const rateLimit = await consumeRateLimit({
      action: 'developer-submission',
      identity: access.user.id,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many Contributor submissions.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        nextAction: 'Wait for the submission window to reset, then retry the same upload.',
        resource: 'developer_submission_attempts',
        maximum: 30,
        unit: 'attempts_per_hour',
      });
    }
    const body = await request.json() as Record<string, unknown>;
    const uploadedFile = body.uploadedFile;
    if (!uploadedFile || typeof uploadedFile !== 'object' || Array.isArray(uploadedFile)) {
      return createApiErrorResponse(400, 'pipeline_request_invalid', 'Upload a source file before submitting it to Forge Review.');
    }
    const submissionContext = await getPipelineContributorSummary(access.user.id);
    await createUploadedPipelineSubmission({
      contributorId: access.user.id,
      contributorEmail: access.email,
      maxFileSizeMb: submissionContext.maxSubmissionFileSizeMb,
      assetType: body.assetType,
      studioDestination: body.studioDestination,
      specialtyTags: body.specialtyTags,
      useCaseTags: body.useCaseTags,
      name: body.name,
      description: body.description,
      previewUrl: body.previewUrl,
      uploadedFile: uploadedFile as {
        storagePath: string;
        fileName: string;
        fileSizeBytes: number;
        mimeType: string;
      },
    });
    revalidateCardForgeCatalog();
    return createNoStoreJsonResponse({ submitted: true }, { status: 201 });
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
          : error.status === 403
            ? 'contributor_access_required'
            : error.status === 503
              ? 'pipeline_unavailable'
              : error.boundary.kind === 'limit'
                ? 'pipeline_limit'
                : 'pipeline_request_invalid',
        error.message,
        {
          kind: error.boundary.kind,
          nextAction: error.boundary.nextAction,
          limit: error.boundary.limit,
        },
      );
    }

    console.error('Failed to create Pipeline submission:', error);
    return createApiErrorResponse(
      500,
      'pipeline_request_invalid',
      'Unable to create Pipeline submission.'
    );
  }
}

export async function PUT(request: Request) {
  try {
    const access = await getOwnerAccess();
    if (!access.ok) return access.response;

    const ownerUserId = access.owner.userId;
    if (!ownerUserId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for Contributor program settings.');
    }
    const body = await request.json() as { settings?: Record<string, unknown> };
    const program = await updatePipelineProgramSettings(
      body.settings ?? {},
      ownerUserId,
      getPipelineContributorIds(ownerUserId)
    );
    revalidateCardForgeCatalog();
    return createNoStoreJsonResponse({ program });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'pipeline_unavailable' : 'pipeline_request_invalid',
        error.message
      );
    }

    console.error('Failed to update Pipeline settings:', error);
    return createApiErrorResponse(
      500,
      'pipeline_request_invalid',
      'Unable to update Pipeline settings.'
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getOwnerAccess();
    if (!access.ok) return access.response;

    const ownerUserId = access.owner.userId;
    if (!ownerUserId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for Contributor profile settings.');
    }
    const body = await request.json() as {
      contributorId?: unknown;
      profile?: {
        status?: unknown;
        monthlySubmissionLimitOverride?: unknown;
        monthlyPublishedRequirementOverride?: unknown;
        ownerNote?: unknown;
      };
    };
    const program = await updateContributorProfileOverrides({
      contributorId: typeof body.contributorId === 'string' ? body.contributorId : '',
      input: body.profile ?? {},
      currentUserId: ownerUserId,
      currentContributorIds: getPipelineContributorIds(ownerUserId),
    });
    return createNoStoreJsonResponse({ program });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof PipelineStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'pipeline_unavailable' : 'pipeline_request_invalid',
        error.message
      );
    }

    console.error('Failed to update Contributor profile settings:', error);
    return createApiErrorResponse(
      500,
      'pipeline_request_invalid',
      'Unable to update Contributor profile settings.'
    );
  }
}
