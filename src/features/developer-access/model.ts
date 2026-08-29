export const DEVELOPER_PROFILE_STATUSES = [
  'invited',
  'active',
  'inactive',
  'suspended',
] as const;

export type DeveloperProfileStatus = typeof DEVELOPER_PROFILE_STATUSES[number];

export const DEVELOPER_CONTRIBUTION_SCOPES = [
  'assets.submit',
  'assets.review',
  'library.submit',
  'library.publish',
  'studio.ai.create',
  'campaigns.draft',
  'campaigns.approve',
  'campaigns.publish',
  'site.propose',
  'site.publish',
  'scopes.manage',
] as const;

export type DeveloperContributionScope = typeof DEVELOPER_CONTRIBUTION_SCOPES[number];

export const DEVELOPER_CONTRIBUTION_SCOPE_LABELS: Record<DeveloperContributionScope, string> = {
  'assets.submit': 'Submit library assets',
  'assets.review': 'Review library assets',
  'library.submit': 'Submit shared library revisions',
  'library.publish': 'Publish shared library revisions',
  'studio.ai.create': 'Create private Studio drafts with AI',
  'campaigns.draft': 'Draft campaign packages',
  'campaigns.approve': 'Approve campaign packages',
  'campaigns.publish': 'Publish approved campaigns',
  'site.propose': 'Propose site improvements',
  'site.publish': 'Publish approved site copy',
  'scopes.manage': 'Manage contributor access',
};

export interface DeveloperAccessProfile {
  developerId: string;
  email: string | null;
  displayName: string | null;
  status: DeveloperProfileStatus;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
}

export interface DeveloperAccessProjection {
  hasCockpitAccess: boolean;
  cockpitHref: '/account?section=library&scope=pipeline';
  scopes: readonly DeveloperContributionScope[];
}

export interface DeveloperAccessSessionState {
  sessionKey: string | null;
  projection: DeveloperAccessProjection;
}

export const EMPTY_DEVELOPER_ACCESS_PROJECTION: DeveloperAccessProjection = {
  hasCockpitAccess: false,
  cockpitHref: '/account?section=library&scope=pipeline',
  scopes: [],
};

export const OWNER_DEVELOPER_ACCESS_PROJECTION: DeveloperAccessProjection = {
  hasCockpitAccess: true,
  cockpitHref: '/account?section=library&scope=pipeline',
  scopes: DEVELOPER_CONTRIBUTION_SCOPES,
};

export const EMPTY_DEVELOPER_ACCESS_SESSION_STATE: DeveloperAccessSessionState = {
  sessionKey: null,
  projection: EMPTY_DEVELOPER_ACCESS_PROJECTION,
};

export const resolveDeveloperAccessProjectionForSession = ({
  eligible,
  isOwner,
  sessionKey,
  state,
}: {
  eligible: boolean;
  isOwner: boolean;
  sessionKey: string | null;
  state: DeveloperAccessSessionState;
}): DeveloperAccessProjection => {
  if (!sessionKey || !eligible) return EMPTY_DEVELOPER_ACCESS_PROJECTION;
  if (isOwner) return OWNER_DEVELOPER_ACCESS_PROJECTION;
  return state.sessionKey === sessionKey
    ? state.projection
    : EMPTY_DEVELOPER_ACCESS_PROJECTION;
};

export const shouldClearStoredDeveloperAccess = ({
  eligible,
  isOwner,
  sessionKey,
  state,
}: {
  eligible: boolean;
  isOwner: boolean;
  sessionKey: string | null;
  state: DeveloperAccessSessionState;
}): boolean => (
  (!sessionKey || !eligible || isOwner) && state.sessionKey !== null
);

export const resolveDeveloperContributionScopes = ({
  isOwner,
  profileStatus,
  canDraftCampaigns,
  canProposeSiteContent,
}: {
  isOwner: boolean;
  profileStatus: DeveloperProfileStatus | null;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
}): DeveloperContributionScope[] => {
  if (isOwner) return [...DEVELOPER_CONTRIBUTION_SCOPES];
  if (profileStatus !== 'active') return [];

  return [
    'assets.submit',
    'assets.review',
    'library.submit',
    'studio.ai.create',
    ...(canDraftCampaigns ? ['campaigns.draft' as const] : []),
    ...(canProposeSiteContent ? ['site.propose' as const] : []),
  ];
};

export const hasContributionScope = (
  scopes: readonly DeveloperContributionScope[],
  scope: DeveloperContributionScope,
): boolean => scopes.includes(scope);
