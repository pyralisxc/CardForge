import {
  AccountIdentityUnavailableError,
  getCurrentCardforgeUserAccess,
  resolveCardforgeEntitlementForAccess,
} from '@/features/account/server';
import {
  ContributorAccessStoreError,
  getContributorCapabilities,
  hasContributionScope,
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

  const { user, ownerAccess } = accountAccess;
  if (!user) {
    throw new PipelineStoreError('Sign in before using Contributor Pipeline tools.', 401);
  }

  const entitlement = await resolveCardforgeEntitlementForAccess(accountAccess);
  let contribution: Awaited<ReturnType<typeof getContributorCapabilities>>;
  try {
    contribution = await getContributorCapabilities({
      user,
      entitlement,
      isOwner: ownerAccess.isOwner,
    });
  } catch (error) {
    if (error instanceof ContributorAccessStoreError) {
      throw new PipelineStoreError(error.message, error.status);
    }
    throw error;
  }

  if (!contribution.active) {
    throw new PipelineStoreError(
      entitlement.authorities.contributor
        ? 'This Contributor profile is not active. Contact the CardForge owner if access should be restored.'
        : 'Contributor access is required for Pipeline submissions.',
      403,
    );
  }

  return {
    user,
    ownerAccess,
    isOwner: ownerAccess.isOwner,
    isContributor: entitlement.authorities.contributor,
    email: user.email,
    scopes: contribution.scopes,
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
