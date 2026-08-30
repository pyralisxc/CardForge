import {
  AccountToolAccessError,
  getCurrentAccountToolAccess,
  type AccountToolAccess,
} from '@/features/account/server';
import {
  EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE,
  hasContributionScope,
  resolveContributorScopes,
  type ContributorAccessProjection,
  type ContributorAccessSessionState,
  type ContributorScope,
} from '@/features/contributor-access/model';
import {
  getContributorProfileCapabilities,
  upsertContributorProfile,
} from '@/features/contributor-access/server/profileStore';

export interface ContributorAccess extends AccountToolAccess {
  scopes: ContributorScope[];
}

export class ContributorAccessError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
    this.name = 'ContributorAccessError';
  }
}

export const getContributorCapabilities = async (
  account: AccountToolAccess,
): Promise<ContributorAccessProjection> => {
  if (account.isOwner) {
    return {
      active: true,
      scopes: resolveContributorScopes({
        isOwner: true,
        profileStatus: null,
        canDraftCampaigns: false,
        canProposeSiteContent: false,
      }),
    };
  }

  if (account.entitlement.accessMode !== 'dev') {
    return { active: false, scopes: [] };
  }

  await upsertContributorProfile({
    contributorId: account.user.id,
    email: account.user.email,
    firstName: account.user.firstName,
    lastName: account.user.lastName,
  });
  const capabilities = await getContributorProfileCapabilities(account.user.id);
  if (capabilities.status !== 'active') {
    return { active: false, scopes: [] };
  }

  const extendedContributionsEnabled = process.env.CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED === 'true';
  return {
    active: true,
    scopes: resolveContributorScopes({
      isOwner: false,
      profileStatus: capabilities.status,
      canDraftCampaigns: capabilities.canDraftCampaigns && extendedContributionsEnabled,
      canProposeSiteContent: capabilities.canProposeSiteContent && extendedContributionsEnabled,
    }),
  };
};

export const getCurrentContributorAccess = async (): Promise<ContributorAccess> => {
  const account = await getCurrentAccountToolAccess();
  const contribution = await getContributorCapabilities(account);
  if (!contribution.active) {
    throw new ContributorAccessError('Active Contributor access is required for that contribution workflow.', 403);
  }
  return { ...account, scopes: [...contribution.scopes] };
};

export const requireContributionScope = (
  access: { scopes: readonly ContributorScope[] },
  scope: ContributorScope,
): void => {
  if (!hasContributionScope(access.scopes, scope)) {
    throw new ContributorAccessError('Your Contributor account does not have permission for that contribution lane.', 403);
  }
};

export const getCurrentContributorAccessProjection = async (): Promise<ContributorAccessProjection> => (
  (await getCurrentContributorAccessSessionState()).projection
);

export const getCurrentContributorAccessSessionState = async (): Promise<ContributorAccessSessionState> => {
  try {
    const account = await getCurrentAccountToolAccess();
    const projection = await getContributorCapabilities(account);
    return { sessionKey: account.user.id, projection };
  } catch (error) {
    if (error instanceof AccountToolAccessError || error instanceof ContributorAccessError) {
      return EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE;
    }
    throw error;
  }
};
