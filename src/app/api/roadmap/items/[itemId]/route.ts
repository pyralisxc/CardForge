import { currentUser } from '@clerk/nextjs/server';

import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { resolveOwnerAccess } from '@/domain/entitlements';
import { deleteDeveloperRoadmapItem, RoadmapStoreError } from '@/features/roadmap/server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return createApiErrorResponse(
        401,
        'sign_in_required',
        'Sign in before managing roadmap items.'
      );
    }

    const emailAddresses = user.emailAddresses.map((email) => email.emailAddress);
    const ownerAccess = resolveOwnerAccess({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses,
      publicMetadata: user.publicMetadata,
      privateMetadata: user.privateMetadata,
    });
    if (!ownerAccess.isOwner) {
      return createApiErrorResponse(
        403,
        'owner_access_required',
        'Owner access is required to manage CardForge-authored timeline items.'
      );
    }

    const { itemId } = await context.params;
    const payload = await deleteDeveloperRoadmapItem({
      userId: user.id,
      itemId,
    });

    return createNoStoreJsonResponse(payload);
  } catch (error) {
    if (error instanceof RoadmapStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'roadmap_database_unavailable' : 'roadmap_request_invalid',
        error.message
      );
    }

    console.error('Failed to delete roadmap item:', error);
    return createApiErrorResponse(
      500,
      'roadmap_request_invalid',
      'Unable to delete roadmap item.'
    );
  }
}
