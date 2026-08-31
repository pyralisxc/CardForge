import { describe, expect, it } from 'vitest';

import { projectAccountExperience } from '@/features/account/lib/accountExperience';
import { resolveAccountEntitlement } from '@/features/account/lib/accountEntitlement';

const entitlement = (
  privateMetadata: Record<string, unknown> = {},
  owner = false,
) => resolveAccountEntitlement({
  authConfigured: true,
  isSignedIn: true,
  emailAddresses: ['creator@example.com'],
  privateMetadata,
  ownerAccess: owner
    ? { isOwner: true, source: 'clerk_private_metadata' }
    : { isOwner: false, source: 'none' },
  env: {},
});

describe('account experience projection', () => {
  it('keeps plan, contribution, and owner authority as independent axes', () => {
    const free = projectAccountExperience({ entitlement: entitlement() });
    const creator = projectAccountExperience({
      entitlement: entitlement({ cardforgeAccess: 'paid', cardforgePaidPlan: 'creator' }),
    });
    const designer = projectAccountExperience({
      entitlement: entitlement({ cardforgeAccess: 'paid', cardforgePaidPlan: 'designer' }),
    });
    const contributor = projectAccountExperience({
      entitlement: entitlement({ cardforgeAccess: 'contributor' }),
      contribution: {
        active: true,
        canSubmit: true,
        canReview: true,
        canPublish: false,
        canDraftCampaigns: true,
        canProposeSite: true,
      },
    });
    const owner = projectAccountExperience({
      entitlement: entitlement({}, true),
      contribution: {
        active: true,
        canSubmit: true,
        canReview: true,
        canPublish: true,
        canDraftCampaigns: true,
        canProposeSite: true,
      },
    });

    expect(free).toMatchObject({ plan: 'free', contributor: { active: false }, owner: false });
    expect(creator).toMatchObject({ plan: 'creator', contributor: { active: false }, owner: false });
    expect(designer).toMatchObject({ plan: 'designer', contributor: { active: false }, owner: false });
    expect(contributor).toMatchObject({ plan: 'creator', contributor: { active: true, canPublish: false }, owner: false });
    expect(owner).toMatchObject({ plan: 'creator', contributor: { active: true, canPublish: true }, owner: true });
  });

  it('does not infer contributor access from Contributor entitlement without an active scoped profile', () => {
    expect(projectAccountExperience({
      entitlement: entitlement({ cardforgeAccess: 'contributor' }),
    })).toMatchObject({
      plan: 'creator',
      contributor: {
        active: false,
        canSubmit: false,
        canReview: false,
        canPublish: false,
      },
    });
  });
});
