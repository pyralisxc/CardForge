import {
  getCardforgeUserAccessForUserId,
  getCurrentCardforgeUserAccess,
  resolveAccountEntitlement,
  type AccountEntitlement,
  type CardforgeServerUser,
} from '@/features/account/server';
import {
  EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
  hasContributionScope,
  resolveDeveloperContributionScopes,
  type DeveloperAccessProjection,
  type DeveloperAccessSessionState,
  type DeveloperContributionScope,
} from '@/features/developer-access/model';
import {
  getDeveloperProfileCapabilities,
  upsertDeveloperProfile,
} from '@/features/developer-access/server/profileStore';

export interface DeveloperCockpitAccess {
  user: CardforgeServerUser;
  entitlement: AccountEntitlement;
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

const resolveDeveloperCockpitAccess = async ({
  authConfigured,
  user,
  ownerAccess,
}: Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>, {
  allowStudioAiOnly = false,
}: {
  allowStudioAiOnly?: boolean;
} = {}): Promise<DeveloperCockpitAccess> => {
  if (!user) {
    throw new DeveloperCockpitAccessError('Sign in before using CardForge account tools.', 401);
  }

  const entitlement = resolveAccountEntitlement({
    accountUserId: user.id,
    authConfigured,
    isSignedIn: true,
    emailAddresses: user.emailAddresses,
    privateMetadata: user.privateMetadata,
    ownerAccess,
  });
  const isDeveloper = entitlement.accessMode === 'dev';
  if (!isDeveloper && !ownerAccess.isOwner) {
    if (allowStudioAiOnly) {
      return {
        user,
        entitlement,
        isDeveloper: false,
        isOwner: false,
        email: user.email,
        displayName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
        scopes: ['studio.ai.create'],
      };
    }
    throw new DeveloperCockpitAccessError('Developer access is required for the contribution cockpit.', 403);
  }

  await upsertDeveloperProfile({
    developerId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  const isOwner = ownerAccess.isOwner;
  const baseProjection = {
    user,
    entitlement,
    isDeveloper,
    isOwner,
    email: user.email,
    displayName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
  };
  if (isOwner) {
    return {
      ...baseProjection,
      scopes: resolveDeveloperContributionScopes({
        isOwner: true,
        profileStatus: null,
        canDraftCampaigns: false,
        canProposeSiteContent: false,
      }),
    };
  }
  const capabilities = await getDeveloperProfileCapabilities(user.id);
  if (capabilities.status !== 'active') {
    throw new DeveloperCockpitAccessError('This developer profile is not active. Contact the CardForge owner if access should be restored.', 403);
  }
  const extendedContributionsEnabled = process.env.CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED === 'true';
  return {
    ...baseProjection,
    scopes: resolveDeveloperContributionScopes({
      isOwner: false,
      profileStatus: capabilities.status,
      canDraftCampaigns: capabilities.canDraftCampaigns && extendedContributionsEnabled,
      canProposeSiteContent: capabilities.canProposeSiteContent && extendedContributionsEnabled,
    }),
  };
};

export const getCurrentDeveloperCockpitAccess = async (): Promise<DeveloperCockpitAccess> => (
  resolveDeveloperCockpitAccess(await getCurrentCardforgeUserAccess())
);

// MCP private Studio/card tools are account features, not contribution-cockpit features.
// A normal signed-in user receives only studio.ai.create; Forge Review still requires
// library.submit and therefore remains developer/owner gated by requireContributionScope.
export const getDeveloperCockpitAccessForUserId = async (
  userId: string,
): Promise<DeveloperCockpitAccess> => (
  resolveDeveloperCockpitAccess(
    await getCardforgeUserAccessForUserId(userId),
    { allowStudioAiOnly: true },
  )
);

export const requireContributionScope = (
  access: DeveloperCockpitAccess,
  scope: DeveloperContributionScope,
): void => {
  if (!hasContributionScope(access.scopes, scope)) {
    throw new DeveloperCockpitAccessError('Your developer account does not have permission for that contribution lane.', 403);
  }
};

export const getCurrentDeveloperAccessProjection = async (): Promise<DeveloperAccessProjection> => {
  return (await getCurrentDeveloperAccessSessionState()).projection;
};

export const getCurrentDeveloperAccessSessionState = async (): Promise<DeveloperAccessSessionState> => {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    return {
      sessionKey: access.user.id,
      projection: {
        hasCockpitAccess: true,
        cockpitHref: '/account?section=library&scope=pipeline',
        scopes: access.scopes,
      },
    };
  } catch (error) {
    if (error instanceof DeveloperCockpitAccessError) return EMPTY_DEVELOPER_ACCESS_SESSION_STATE;
    throw error;
  }
};
