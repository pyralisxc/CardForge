import {
  AccountIdentityUnavailableError,
  getCurrentCardforgeUserAccess,
  resolveAccountEntitlement,
} from '@/features/account/server';
import {
  DeveloperAccessStoreError,
  getDeveloperProfileCapabilities,
  upsertDeveloperProfile,
} from '@/features/developer-access/server';
import { DeveloperAssetStoreError } from '../lib/developerAssetStoreError';

export interface DeveloperAssetRequestAccess {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>['user']>;
  ownerAccess: Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>['ownerAccess'];
  isOwner: boolean;
  isDeveloper: boolean;
  email: string | null;
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
  return {
    user,
    ownerAccess,
    isOwner: ownerAccess.isOwner,
    isDeveloper,
    email: user.email,
  };
};

export const getDeveloperContributorIds = (userId: string): string[] => [userId];

export const syncDeveloperAssetRequestProfile = async (
  access: DeveloperAssetRequestAccess,
): Promise<void> => {
  await upsertDeveloperProfile({
    developerId: access.user.id,
    email: access.email,
    firstName: access.user.firstName,
    lastName: access.user.lastName,
  });
  if (access.isOwner) return;
  let profile: Awaited<ReturnType<typeof getDeveloperProfileCapabilities>>;
  try {
    profile = await getDeveloperProfileCapabilities(access.user.id);
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
};
