import {
  AccountIdentityUnavailableError,
  getCurrentCardforgeUserAccess,
  resolveAccountEntitlement,
} from '@/features/account/server';
import {
  ContributorAccessStoreError,
  getContributorProfileCapabilities,
  hasContributionScope,
  resolveContributorScopes,
  upsertContributorProfile,
  type ContributorScope,
} from '@/features/contributor-access/server';
import { PipelineStoreError } from '../lib/pipelineStoreError';

export interface PipelineRequestAccess {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>['user']>;
  ownerAccess: Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>['ownerAccess'];
  isOwner: boolean;
  isContributor: boolean;
  email: string | null;
  scopes: readonly ContributorScope[];
}

export const getCurrentPipelineRequestAccess = async (): Promise<PipelineRequestAccess> => {
  let accountAccess: Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>;
  try {
    accountAccess = await getCurrentCardforgeUserAccess();
  } catch (error) {
    if (error instanceof AccountIdentityUnavailableError) {
      throw new PipelineStoreError(error.message, error.status);
    }
    throw error;
  }
  const { authConfigured, user, ownerAccess } = accountAccess;
  if (!user) {
    throw new PipelineStoreError('Sign in before using Contributor Pipeline tools.', 401);
  }

  const entitlement = resolveAccountEntitlement({
    authConfigured,
    isSignedIn: true,
    emailAddresses: user.emailAddresses,
    privateMetadata: user.privateMetadata,
    ownerAccess,
  });
  const isContributor = entitlement.accessMode === 'dev';
  if (!isContributor && !ownerAccess.isOwner) {
    throw new PipelineStoreError('Contributor access is required for Pipeline submissions.', 403);
  }
  await upsertContributorProfile({
    contributorId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  if (ownerAccess.isOwner) {
    return {
      user,
      ownerAccess,
      isOwner: true,
      isContributor,
      email: user.email,
      scopes: resolveContributorScopes({
        isOwner: true,
        profileStatus: null,
        canDraftCampaigns: false,
        canProposeSiteContent: false,
      }),
    };
  }
  let profile: Awaited<ReturnType<typeof getContributorProfileCapabilities>>;
  try {
    profile = await getContributorProfileCapabilities(user.id);
  } catch (error) {
    if (error instanceof ContributorAccessStoreError) {
      throw new PipelineStoreError(error.message, error.status);
    }
    throw error;
  }
  if (profile.status !== 'active') {
    throw new PipelineStoreError(
      'This Contributor profile is not active. Contact the CardForge owner if access should be restored.',
      403,
    );
  }
  return {
    user,
    ownerAccess,
    isOwner: false,
    isContributor,
    email: user.email,
    scopes: resolveContributorScopes({
      isOwner: false,
      profileStatus: profile.status,
      canDraftCampaigns: profile.canDraftCampaigns,
      canProposeSiteContent: profile.canProposeSiteContent,
    }),
  };
};

export const getPipelineContributorIds = (userId: string): string[] => [userId];

export const requirePipelineRequestScope = (
  access: PipelineRequestAccess,
  scope: ContributorScope,
): void => {
  if (!hasContributionScope(access.scopes, scope)) {
    throw new PipelineStoreError('Your contributor account does not have permission for this Forge Review action.', 403);
  }
};
