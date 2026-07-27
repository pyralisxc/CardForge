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
    ...(canDraftCampaigns ? ['campaigns.draft' as const] : []),
    ...(canProposeSiteContent ? ['site.propose' as const] : []),
  ];
};

export const hasContributionScope = (
  scopes: readonly DeveloperContributionScope[],
  scope: DeveloperContributionScope,
): boolean => scopes.includes(scope);
