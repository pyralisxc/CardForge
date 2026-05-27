import { resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import {
  DeveloperAssetStoreError,
  getDeveloperAssetVotePolicy,
  upsertDeveloperProfile,
  voteOnDeveloperAssetSubmission,
} from '@/lib/developerAssetStore';
import { getCurrentCardforgeUserAccess } from '@/lib/serverCardforgeUser';

export const dynamic = 'force-dynamic';

const getContributorIds = (userId: string) => [userId];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { authConfigured, user, ownerAccess } = await getCurrentCardforgeUserAccess();
    if (!user) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in before voting on developer assets.');
    }

    const entitlement = resolveAccountEntitlement({
      authConfigured,
      isSignedIn: true,
      emailAddresses: user.emailAddresses,
      privateMetadata: user.privateMetadata,
      ownerAccess,
    });

    if (entitlement.accessMode !== 'dev' && !ownerAccess.isOwner) {
      return createApiErrorResponse(403, 'developer_access_required', 'Developer access is required to vote on asset submissions.');
    }

    const { submissionId } = await params;
    const contributorIds = getContributorIds(user.id);
    const votePolicy = await getDeveloperAssetVotePolicy(submissionId);
    if (
      votePolicy.submissionDeveloperId
      && contributorIds.includes(votePolicy.submissionDeveloperId)
      && !votePolicy.allowContributorSelfVoting
    ) {
      return createApiErrorResponse(400, 'developer_asset_request_invalid', 'Developers cannot vote on their own submissions.');
    }

    const body = await request.json() as { voteValue?: unknown };
    await upsertDeveloperProfile({
      developerId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    const program = await voteOnDeveloperAssetSubmission({
      submissionId,
      developerId: user.id,
      voteValue: body.voteValue,
      currentContributorIds: contributorIds,
      ownerDeveloperId: ownerAccess.isOwner ? user.id : null,
    });

    return createNoStoreJsonResponse({ program });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'developer_asset_unavailable' : 'developer_asset_request_invalid',
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
