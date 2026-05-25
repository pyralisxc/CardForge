import { currentUser } from '@clerk/nextjs/server';

import { resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import {
  DeveloperAssetStoreError,
  getDeveloperAssetProgramView,
  upsertDeveloperProfile,
  voteOnDeveloperAssetSubmission,
} from '@/lib/developerAssetStore';
import { getCurrentOwnerAccess } from '@/lib/serverOwnerAccess';

export const dynamic = 'force-dynamic';

const getContributorIds = (userId: string, isOwner: boolean) => (
  isOwner ? [userId, 'cardforge-official'] : [userId]
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in before voting on developer assets.');
    }

    const ownerAccess = await getCurrentOwnerAccess();
    const entitlement = resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: user.emailAddresses.map((email) => email.emailAddress),
      privateMetadata: user.privateMetadata,
      ownerAccess,
    });

    if (entitlement.accessMode !== 'dev' && !ownerAccess.isOwner) {
      return createApiErrorResponse(403, 'developer_access_required', 'Developer access is required to vote on asset submissions.');
    }

    const contributorIds = getContributorIds(user.id, ownerAccess.isOwner);
    await upsertDeveloperProfile({
      developerId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    const { submissionId } = await params;
    const existingProgram = await getDeveloperAssetProgramView(user.id, contributorIds);
    const submission = existingProgram.submissions.find((candidate) => candidate.id === submissionId);
    if (
      submission
      && contributorIds.includes(submission.developerId)
      && !existingProgram.settings.allowContributorSelfVoting
    ) {
      return createApiErrorResponse(400, 'developer_asset_request_invalid', 'Developers cannot vote on their own submissions.');
    }

    const body = await request.json() as { voteValue?: unknown };
    const program = await voteOnDeveloperAssetSubmission({
      submissionId,
      developerId: user.id,
      voteValue: body.voteValue,
      currentContributorIds: contributorIds,
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
