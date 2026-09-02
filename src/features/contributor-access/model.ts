export const CONTRIBUTOR_PROFILE_STATUSES = [
  'invited',
  'active',
  'inactive',
  'suspended',
] as const;

export type ContributorProfileStatus = typeof CONTRIBUTOR_PROFILE_STATUSES[number];

export const CONTRIBUTOR_SCOPES = [
  'assets.submit',
  'assets.review',
  'library.submit',
  'library.publish',
  'campaigns.draft',
  'campaigns.approve',
  'campaigns.publish',
  'scopes.manage',
] as const;

export type ContributorScope = typeof CONTRIBUTOR_SCOPES[number];

export const CONTRIBUTOR_SCOPE_LABELS: Record<ContributorScope, string> = {
  'assets.submit': 'Submit library assets',
  'assets.review': 'Review library assets',
  'library.submit': 'Submit shared library revisions',
  'library.publish': 'Publish shared library revisions',
  'campaigns.draft': 'Draft campaign packages',
  'campaigns.approve': 'Approve campaign packages',
  'campaigns.publish': 'Publish approved campaigns',
  'scopes.manage': 'Manage contributor access',
};

export interface ContributorAccessProfile {
  contributorId: string;
  email: string | null;
  displayName: string | null;
  status: ContributorProfileStatus;
  canDraftCampaigns: boolean;
}

export interface ContributorAccessProjection {
  active: boolean;
  scopes: readonly ContributorScope[];
}

export interface ContributorAccessSessionState {
  sessionKey: string | null;
  projection: ContributorAccessProjection;
}

export const EMPTY_CONTRIBUTOR_ACCESS_PROJECTION: ContributorAccessProjection = {
  active: false,
  scopes: [],
};

export const OWNER_CONTRIBUTOR_ACCESS_PROJECTION: ContributorAccessProjection = {
  active: true,
  scopes: CONTRIBUTOR_SCOPES,
};

export const EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE: ContributorAccessSessionState = {
  sessionKey: null,
  projection: EMPTY_CONTRIBUTOR_ACCESS_PROJECTION,
};

export const resolveContributorAccessProjectionForSession = ({
  eligible,
  isOwner,
  sessionKey,
  state,
}: {
  eligible: boolean;
  isOwner: boolean;
  sessionKey: string | null;
  state: ContributorAccessSessionState;
}): ContributorAccessProjection => {
  if (!sessionKey || !eligible) return EMPTY_CONTRIBUTOR_ACCESS_PROJECTION;
  if (isOwner) return OWNER_CONTRIBUTOR_ACCESS_PROJECTION;
  return state.sessionKey === sessionKey
    ? state.projection
    : EMPTY_CONTRIBUTOR_ACCESS_PROJECTION;
};

export const shouldClearStoredContributorAccess = ({
  eligible,
  isOwner,
  sessionKey,
  state,
}: {
  eligible: boolean;
  isOwner: boolean;
  sessionKey: string | null;
  state: ContributorAccessSessionState;
}): boolean => (
  (!sessionKey || !eligible || isOwner) && state.sessionKey !== null
);

export const resolveContributorScopes = ({
  isOwner,
  profileStatus,
  canDraftCampaigns,
}: {
  isOwner: boolean;
  profileStatus: ContributorProfileStatus | null;
  canDraftCampaigns: boolean;
}): ContributorScope[] => {
  if (isOwner) return [...CONTRIBUTOR_SCOPES];
  if (profileStatus !== 'active') return [];

  return [
    'assets.submit',
    'assets.review',
    'library.submit',
    ...(canDraftCampaigns ? ['campaigns.draft' as const] : []),
  ];
};

export const hasContributionScope = (
  scopes: readonly ContributorScope[],
  scope: ContributorScope,
): boolean => scopes.includes(scope);
