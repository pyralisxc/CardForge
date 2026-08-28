import type { ProjectCapabilities } from '@/domain/entitlements';

import type { AccountEntitlement } from './accountEntitlement';

export type AccountExperiencePlan = 'free' | 'creator' | 'designer';

export interface AccountContributionExperience {
  active: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canPublish: boolean;
}

export interface AccountExperienceProjection {
  signedIn: boolean;
  plan: AccountExperiencePlan;
  capabilities: ProjectCapabilities;
  contributor: AccountContributionExperience;
  owner: boolean;
}

const EMPTY_CONTRIBUTION: AccountContributionExperience = {
  active: false,
  canSubmit: false,
  canReview: false,
  canPublish: false,
};

export const projectAccountExperience = ({
  entitlement,
  contribution = EMPTY_CONTRIBUTION,
}: {
  entitlement: AccountEntitlement;
  contribution?: AccountContributionExperience;
}): AccountExperienceProjection => ({
  signedIn: entitlement.isSignedIn,
  plan: entitlement.paidPlan === 'designer'
    ? 'designer'
    : entitlement.canExportClean
      ? 'creator'
      : 'free',
  capabilities: entitlement.capabilities,
  contributor: contribution.active ? { ...contribution } : { ...EMPTY_CONTRIBUTION },
  owner: entitlement.isSignedIn && entitlement.ownerAccess.isOwner,
});
