import {
  AccountIdentityUnavailableError,
  getCurrentCardforgeUserAccess,
  resolveAccountEntitlement,
} from '@/features/account/server';
import {
  DeveloperAccessStoreError,
  getDeveloperProfileCapabilities,
  hasContributionScope,
  resolveDeveloperContributionScopes,
  upsertDeveloperProfile,
  type DeveloperContributionScope,
} from '@/features/developer-access/server';
import { DeveloperAssetStoreError } from '../lib/developerAssetStoreError';

export interface DeveloperAssetRequestAccess {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>['user']>;
  ownerAccess: Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>['ownerAccess'];
  isOwner: boolean;
  isDeveloper: boolean;
  email: string | null;
  scopes: readonly DeveloperContributionScope[];
}

export const getCurrentDeveloperAssetRequestAccess = async (): Promise<DeveloperAssetRequestAccess> => {
  let accountAccess: Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>;
  try {
    accountAccess = await getCurrentCardforgeUserAccess();
  } catch (error) {
    if (error instanceof AccountIdentityUnavailableError) {
      throw new DeveloperAssetStoreError(error.message, error.status);
    }
    throw error;
  }
  const { authConfigured, user, ownerAccess } = accountAccess;
  if (!user) {
    throw new DeveloperAssetStoreError('Sign in before using developer asset tools.', 401);
  }

  const entitlement = resolveAccountEntitlement({
    authConfigured,
    isSignedIn: true,
    emailAddresses: user.emailAddresses,
    privateMetadata: user.privateMetadata,
    ownerAccess,
  });
  const isDeveloper = entitlement.accessMode === 'dev';
  if (!isDeveloper && !ownerAccess.isOwner) {
    throw new DeveloperAssetStoreError('Developer access is required for asset submissions.', 403);
  }
  await upsertDeveloperProfile({
    developerId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  if (ownerAccess.isOwner) {
    return {
      user,
      ownerAccess,
      isOwner: true,
      isDeveloper,
      email: user.email,
      scopes: resolveDeveloperContributionScopes({
        isOwner: true,
        profileStatus: null,
        canDraftCampaigns: false,
        canProposeSiteContent: false,
      }),
    };
  }
  let profile: Awaited<ReturnType<typeof getDeveloperProfileCapabilities>>;
  try {
    profile = await getDeveloperProfileCapabilities(user.id);
  } catch (error) {
    if (error instanceof DeveloperAccessStoreError) {
      throw new DeveloperAssetStoreError(error.message, error.status);
    }
    throw error;
  }
  if (profile.status !== 'active') {
    throw new DeveloperAssetStoreError(
      'This developer profile is not active. Contact the CardForge owner if access should be restored.',
      403,
    );
  }
  return {
    user,
    ownerAccess,
    isOwner: false,
    isDeveloper,
    email: user.email,
    scopes: resolveDeveloperContributionScopes({
      isOwner: false,
      profileStatus: profile.status,
      canDraftCampaigns: profile.canDraftCampaigns,
      canProposeSiteContent: profile.canProposeSiteContent,
    }),
  };
};

export const getDeveloperContributorIds = (userId: string): string[] => [userId];

export const requireDeveloperAssetRequestScope = (
  access: DeveloperAssetRequestAccess,
  scope: DeveloperContributionScope,
): void => {
  if (!hasContributionScope(access.scopes, scope)) {
    throw new DeveloperAssetStoreError('Your contributor account does not have permission for this Forge Review action.', 403);
  }
};
