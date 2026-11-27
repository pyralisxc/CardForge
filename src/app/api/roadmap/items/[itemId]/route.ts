import { currentUser } from '@clerk/nextjs/server';

import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { resolveOwnerAccess } from '@/domain/entitlements';
import { deleteContributorRoadmapItem, RoadmapStoreError } from '@/features/roadmap/server';
import { AccountIdentityUnavailableError, AccountToolAccessError, getCurrentAccountToolAccess } from '@/features/account/server';
import { ContributorAccessStoreError, hasContributionScope, readContributorCapabilities } from '@/features/contributor-access/server';
import { publishOwnerRoadmapDetails } from '@/features/owner/server/ownerSiteCommands';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const account = await getCurrentAccountToolAccess();
    const contribution = account.isOwner ? null : await readContributorCapabilities(account);
    if (!account.isOwner && (!contribution?.active || !hasContributionScope(contribution.scopes, 'roadmap.edit'))) {
      return createApiErrorResponse(403, 'contributor_access_required', 'Roadmap editing permission is required.');
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return createApiErrorResponse(400, 'roadmap_request_invalid', 'Provide Roadmap item details.');
    const fields = body as Record<string, unknown>;
    if (!account.isOwner && (fields.itemType === 'roi_checkpoint' || ['monthlyCostCents', 'expenseProvider', 'expensePlan', 'expenseSourceUrl', 'expenseVerifiedAt', 'expenseState'].some(key => key in fields))) {
      return createApiErrorResponse(403, 'owner_access_required', 'Only an Owner can edit expense checkpoints.');
    }
    const { itemId } = await context.params;
    const publication = await publishOwnerRoadmapDetails({ actor: { userId: account.user.id, email: account.email }, input: { ...fields, itemId } });
    return createNoStoreJsonResponse({ publication });
  } catch (error) {
    if (error instanceof SyntaxError) return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    if (error instanceof AccountIdentityUnavailableError || error instanceof AccountToolAccessError || error instanceof RoadmapStoreError || error instanceof ContributorAccessStoreError) {
      return createApiErrorResponse(error.status, error.status === 503 ? 'roadmap_database_unavailable' : error.status === 403 ? 'contributor_access_required' : error.status === 401 ? 'sign_in_required' : 'roadmap_request_invalid', error.message);
    }
    console.error('Failed to edit roadmap item:', error);
    return createApiErrorResponse(500, 'roadmap_request_invalid', 'Unable to update roadmap details.');
  }
}

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
    const payload = await deleteContributorRoadmapItem({
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
