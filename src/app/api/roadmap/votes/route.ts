import { currentUser } from '@clerk/nextjs/server';

import { voteRoadmapItem, RoadmapStoreError } from '@/lib/roadmapStore';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';

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
