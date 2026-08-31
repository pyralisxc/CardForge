import { getCurrentCardforgeUserAccess, resolveAccountEntitlement } from '@/features/account/server';
import { getContributorProfileCapabilities } from '@/features/contributor-access/server';
import { getPipelineHeartMetrics, getViewerVisiblePipelineLineageIds, isPipelineLineageId, parsePipelineLineageIds, PipelineHeartMutationError, setPipelineHeart } from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const getViewer = async () => {
  const access = await getCurrentCardforgeUserAccess();
  const entitlement = resolveAccountEntitlement({
    authConfigured: access.authConfigured,
    isSignedIn: Boolean(access.user),
    emailAddresses: access.user?.emailAddresses ?? [],
    privateMetadata: access.user?.privateMetadata ?? {},
    ownerAccess: access.ownerAccess,
  });
  const contributor = access.ownerAccess.isOwner || (access.user && entitlement.accessMode === 'contributor'
    ? (await getContributorProfileCapabilities(access.user.id)).status === 'active'
    : false);
  return { access, entitlement, contributor, owner: access.ownerAccess.isOwner };
};

export async function GET(request: Request) {
  try {
    const parsedLineageIds = parsePipelineLineageIds(new URL(request.url).searchParams.getAll('lineageId'));
    if (!parsedLineageIds.valid) {
      return createApiErrorResponse(400, 'pipeline_reaction_invalid', 'Pipeline lineage IDs must be valid and limited to 250 per request.');
    }
    const viewer = await getViewer();
    const visibleLineageIds = await getViewerVisiblePipelineLineageIds({
      lineageIds: parsedLineageIds.lineageIds,
      viewerAccess: viewer.entitlement.accessMode,
      contributor: viewer.contributor,
      viewerId: viewer.access.user?.id ?? null,
      owner: viewer.owner,
    });
    return createNoStoreJsonResponse({ metrics: await getPipelineHeartMetrics(
      visibleLineageIds,
      viewer.access.user?.id ?? null,
    ) });
  } catch (error) {
    console.error('Failed to load Pipeline hearts:', error);
    return createApiErrorResponse(503, 'pipeline_reaction_unavailable', 'Pipeline reactions are temporarily unavailable.');
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer.access.user) return createApiErrorResponse(401, 'sign_in_required', 'Sign in to heart Pipeline work.');
    const rateLimit = await consumeRateLimit({
      action: 'pipeline-heart',
      identity: viewer.access.user.id,
      limit: 240,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many Pipeline reactions.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'pipeline_reactions',
        maximum: 240,
        unit: 'attempts_per_hour',
      });
    }
    const body = await request.json() as { lineageId?: unknown; hearted?: unknown };
    if (!isPipelineLineageId(body.lineageId) || typeof body.hearted !== 'boolean') {
      return createApiErrorResponse(400, 'pipeline_reaction_invalid', 'Choose a visible Pipeline object to heart.');
    }
    const metric = await setPipelineHeart({
      lineageId: body.lineageId,
      accountId: viewer.access.user.id,
      hearted: body.hearted,
      viewerAccess: viewer.entitlement.accessMode,
      contributor: viewer.contributor,
      owner: viewer.owner,
    });
    return createNoStoreJsonResponse({ metric });
  } catch (error) {
    if (error instanceof SyntaxError) return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'pipeline_reaction_unavailable', error.message);
    }
    if (error instanceof PipelineHeartMutationError) {
      return createApiErrorResponse(
        error.status,
        error.status === 404 ? 'pipeline_reaction_not_found' : error.status === 403 ? 'pipeline_reaction_not_permitted' : 'pipeline_reaction_unavailable',
        error.message,
      );
    }
    console.error('Failed to save Pipeline heart:', error);
    return createApiErrorResponse(503, 'pipeline_reaction_unavailable', 'Pipeline reaction could not be saved.');
  }
}
