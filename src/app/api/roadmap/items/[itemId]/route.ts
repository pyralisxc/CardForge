import { currentUser } from '@clerk/nextjs/server';

import { resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { resolveOwnerAccess } from '@/lib/ownerAccess';
import { deleteDeveloperRoadmapItem, RoadmapStoreError } from '@/lib/roadmapStore';

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
    const entitlement = resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses,
      privateMetadata: user.privateMetadata,
      ownerAccess,
    });

    if (entitlement.accessMode !== 'dev') {
      return createApiErrorResponse(
        403,
        'roadmap_request_invalid',
        'Developer access is required to manage official timeline items.'
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
