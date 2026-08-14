import {
  getCurrentCardforgeUserAccess,
  resolveAccountEntitlement,
  type CardforgeServerUser,
} from '@/features/account/server';
import {
  EMPTY_DEVELOPER_ACCESS_PROJECTION,
  hasContributionScope,
  resolveDeveloperContributionScopes,
  type DeveloperAccessProjection,
  type DeveloperContributionScope,
} from '@/features/developer-access/model';
import {
  getDeveloperProfileIdentity,
  getDeveloperProfileCapabilities,
  upsertDeveloperProfile,
} from '@/features/developer-access/server/profileStore';

export interface DeveloperCockpitAccess {
  user: CardforgeServerUser;
  isDeveloper: boolean;
  isOwner: boolean;
  scopes: DeveloperContributionScope[];
  email: string | null;
  displayName: string | null;
}

export class DeveloperCockpitAccessError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
  }
}

export const getCurrentDeveloperCockpitAccess = async (): Promise<DeveloperCockpitAccess> => {
  const { authConfigured, user, ownerAccess } = await getCurrentCardforgeUserAccess();
  if (!user) {
    throw new DeveloperCockpitAccessError('Sign in before using the developer cockpit.', 401);
  }

  const storedIdentity = user.source === 'session_profile'
    ? await getDeveloperProfileIdentity(user.id)
    : null;
  const resolvedEmail = user.email ?? storedIdentity?.email ?? null;
  const resolvedUser: CardforgeServerUser = {
    ...user,
    email: resolvedEmail,
    emailAddresses: user.emailAddresses.length > 0
      ? user.emailAddresses
      : resolvedEmail ? [resolvedEmail] : [],
    firstName: user.firstName ?? storedIdentity?.firstName ?? null,
    lastName: user.lastName ?? storedIdentity?.lastName ?? null,
  };

  const entitlement = resolveAccountEntitlement({
    authConfigured,
    isSignedIn: true,
    emailAddresses: resolvedUser.emailAddresses,
    privateMetadata: resolvedUser.privateMetadata,
    ownerAccess,
  });
  const isDeveloper = entitlement.accessMode === 'dev';
  if (!isDeveloper && !ownerAccess.isOwner) {
    throw new DeveloperCockpitAccessError('Developer access is required for the contribution cockpit.', 403);
  }

  await upsertDeveloperProfile({
    developerId: resolvedUser.id,
    email: resolvedUser.email,
    firstName: resolvedUser.firstName,
    lastName: resolvedUser.lastName,
  });
  const capabilities = await getDeveloperProfileCapabilities(resolvedUser.id);
  const isOwner = ownerAccess.isOwner;
  if (!isOwner && capabilities.status !== 'active') {
    throw new DeveloperCockpitAccessError('This developer profile is not active. Contact the CardForge owner if access should be restored.', 403);
  }
  const extendedContributionsEnabled = process.env.CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED === 'true';
  return {
    user: resolvedUser,
    isDeveloper,
    isOwner,
    email: resolvedUser.email,
    displayName: [resolvedUser.firstName, resolvedUser.lastName].filter(Boolean).join(' ').trim() || resolvedUser.email,
    scopes: resolveDeveloperContributionScopes({
      isOwner,
      profileStatus: capabilities.status,
      canDraftCampaigns: capabilities.canDraftCampaigns && extendedContributionsEnabled,
      canProposeSiteContent: capabilities.canProposeSiteContent && extendedContributionsEnabled,
    }),
  };
};

export const requireContributionScope = (
  access: DeveloperCockpitAccess,
  scope: DeveloperContributionScope,
): void => {
  if (!hasContributionScope(access.scopes, scope)) {
    throw new DeveloperCockpitAccessError('Your developer account does not have permission for that contribution lane.', 403);
  }
};

export const getCurrentDeveloperAccessProjection = async (): Promise<DeveloperAccessProjection> => {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    return {
      hasCockpitAccess: true,
      cockpitHref: '/developer/cockpit',
      canSubmitTemplateRevisions: hasContributionScope(access.scopes, 'library.submit'),
      canPublishSharedLibrary: hasContributionScope(access.scopes, 'library.publish'),
    };
  } catch (error) {
    if (error instanceof DeveloperCockpitAccessError) return EMPTY_DEVELOPER_ACCESS_PROJECTION;
    throw error;
  }
};
