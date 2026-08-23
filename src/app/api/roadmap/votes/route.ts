import { currentUser } from '@clerk/nextjs/server';

import { voteRoadmapItem, RoadmapStoreError } from '@/features/roadmap/server';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return createApiErrorResponse(
        401,
        'sign_in_required',
        'Sign in before voting on roadmap features.'
      );
    }

    const rateLimit = await consumeRateLimit({
      action: 'roadmap-vote',
      identity: user.id,
      limit: 120,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many roadmap votes.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'roadmap_votes',
        maximum: 120,
        unit: 'attempts_per_hour',
      });
    }

    const body = await request.json() as { itemId?: unknown; vote?: unknown };
    const payload = await voteRoadmapItem({
      userId: user.id,
      itemId: body.itemId,
      vote: body.vote,
    });

    return createNoStoreJsonResponse(payload);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'roadmap_database_unavailable', error.message);
    }
    if (error instanceof RoadmapStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 404
          ? 'roadmap_item_unavailable'
          : error.status === 503
            ? 'roadmap_database_unavailable'
            : 'roadmap_vote_failed',
        error.message
      );
    }

    console.error('Failed to save roadmap vote:', error);
    return createApiErrorResponse(
      500,
      'roadmap_vote_failed',
      'Unable to save vote.'
    );
  }
}
