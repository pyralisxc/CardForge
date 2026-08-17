import { describe, expect, it } from 'vitest';

import {
  canTransitionCampaign,
  normalizeCampaignInput,
  normalizeSiteProposalInput,
} from '@/features/developer-cockpit/model';

const marketingContext = {
  marketingCampaignId: '33333333-3333-4333-8333-333333333333',
  audienceKey: 'tabletop-designers',
  contentPillar: 'product-proof',
  funnelStage: 'consideration',
  contentKind: 'demonstration',
  callToAction: 'Enter the Studio',
  creationSource: 'developer',
  utmContent: 'founder_workflow_proof',
} as const;
import {
  EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
  OWNER_DEVELOPER_ACCESS_PROJECTION,
  resolveDeveloperAccessProjectionForSession,
  resolveDeveloperContributionScopes,
  shouldClearStoredDeveloperAccess,
} from '@/features/developer-access/model';
import { assertDerivativeAccess } from '@/features/developer-cockpit/server/media';
import { getVisibleCampaignDerivatives } from '@/features/developer-cockpit/server/storeShared';

describe('developer contribution cockpit', () => {
  it('keeps new contribution powers least-privilege while owners retain every approval boundary', () => {
    expect(resolveDeveloperContributionScopes({
      isOwner: false,
      profileStatus: 'active',
      canDraftCampaigns: false,
      canProposeSiteContent: false,
    })).toEqual(['assets.submit', 'assets.review', 'library.submit']);

    expect(resolveDeveloperContributionScopes({
      isOwner: false,
      profileStatus: 'active',
      canDraftCampaigns: true,
      canProposeSiteContent: true,
    })).toEqual([
      'assets.submit',
      'assets.review',
      'library.submit',
      'campaigns.draft',
      'site.propose',
    ]);

    expect(resolveDeveloperContributionScopes({
      isOwner: false,
      profileStatus: 'suspended',
      canDraftCampaigns: true,
      canProposeSiteContent: true,
    })).toEqual([]);

    expect(resolveDeveloperContributionScopes({
      isOwner: true,
      profileStatus: null,
      canDraftCampaigns: false,
      canProposeSiteContent: false,
    })).toContain('campaigns.publish');
  });

  it('projects owner revision controls from the current trusted account session', () => {
    expect(resolveDeveloperAccessProjectionForSession({
      isOwner: true,
      sessionKey: 'owner-session',
      state: EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
    })).toMatchObject({
      hasCockpitAccess: true,
      canSubmitTemplateRevisions: true,
      canPublishSharedLibrary: true,
    });

    expect(resolveDeveloperAccessProjectionForSession({
      isOwner: true,
      sessionKey: null,
      state: EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
    })).toMatchObject({
      hasCockpitAccess: false,
      canSubmitTemplateRevisions: false,
      canPublishSharedLibrary: false,
    });
  });

  it('clears an owner projection before the same account can return without owner access', () => {
    const priorOwnerState = {
      sessionKey: 'owner-session',
      projection: OWNER_DEVELOPER_ACCESS_PROJECTION,
    };

    expect(shouldClearStoredDeveloperAccess({
      isOwner: true,
      sessionKey: 'owner-session',
      state: priorOwnerState,
    })).toBe(true);
    expect(resolveDeveloperAccessProjectionForSession({
      isOwner: true,
      sessionKey: null,
      state: EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
    })).toBe(EMPTY_DEVELOPER_ACCESS_SESSION_STATE.projection);
    expect(resolveDeveloperAccessProjectionForSession({
      isOwner: false,
      sessionKey: 'owner-session',
      state: EMPTY_DEVELOPER_ACCESS_SESSION_STATE,
    })).toMatchObject({
      canSubmitTemplateRevisions: false,
      canPublishSharedLibrary: false,
    });
  });

  it('normalizes complete channel-specific campaign packages', () => {
    expect(normalizeCampaignInput({
      ...marketingContext,
      title: '  Founder workflow proof  ',
      objective: '  Show the full card-set workflow.  ',
      destinationUrl: 'https://cardforges.com/',
      productionNote: 'Jam 42',
      requestedPublishAt: '2026-08-02T18:00:00.000Z',
      variants: [{
        service: 'facebook',
        text: '  Build one card, then forge the set.  ',
        attachments: [{
          mediaId: '11111111-1111-4111-8111-111111111111',
          altText: 'CardForge Studio showing a generated card set.',
        }],
      }],
    })).toEqual({
      ok: true,
      value: {
        ...marketingContext,
        title: 'Founder workflow proof',
        objective: 'Show the full card-set workflow.',
        destinationUrl: 'https://cardforges.com/',
        productionNote: 'Jam 42',
        requestedPublishAt: '2026-08-02T18:00:00.000Z',
        variants: [{
          service: 'facebook',
          text: 'Build one card, then forge the set.',
          attachments: [{
            mediaId: '11111111-1111-4111-8111-111111111111',
            derivativeId: null,
            displayOrder: 0,
            captionOverride: '',
            cropIntent: {},
            altText: 'CardForge Studio showing a generated card set.',
          }],
        }],
        associations: [],
      },
    });
  });

  it('rejects incomplete campaign and site proposal inputs', () => {
    expect(normalizeCampaignInput({
      ...marketingContext,
      title: 'No channel copy',
      objective: 'Test',
        variants: [],
    })).toEqual({ ok: false, message: 'Add at least one channel variant.' });

    expect(normalizeSiteProposalInput({
      slug: 'unknown.block',
      proposedBody: 'Copy',
      rationale: 'Reason',
    })).toEqual({ ok: false, message: 'Choose a supported public-site copy block.' });

    expect(normalizeCampaignInput({
      ...marketingContext,
      title: 'Legacy storage reference',
      objective: 'A package must refer to canonical media rather than a storage object.',
      variants: [{
        service: 'facebook',
        text: 'This must not preserve a raw storage path.',
        media: [{ sourceBucket: 'campaign-media', sourcePath: 'legacy.png' }],
      }],
    } as never)).toEqual({
      ok: false,
      message: 'Attach CardForge media by ID; storage references are not accepted.',
    });

    expect(normalizeCampaignInput({
      ...marketingContext,
      title: 'Instagram needs an image',
      objective: 'Prevent a delivery that Meta cannot publish.',
      variants: [{ service: 'instagram', text: 'Image coming soon.', attachments: [] }],
    })).toEqual({
      ok: false,
      message: 'Instagram content needs at least one approved image.',
    });

    expect(normalizeCampaignInput({
      ...marketingContext,
      title: 'Instagram caption too long',
      objective: 'Respect the provider limit before review.',
      variants: [{
        service: 'instagram',
        text: 'x'.repeat(2_201),
        attachments: [{
          mediaId: '11111111-1111-4111-8111-111111111111',
          altText: 'A CardForge card set.',
        }],
      }],
    })).toEqual({
      ok: false,
      message: 'Instagram copy must be 2,200 characters or fewer.',
    });
  });

  it('allows contributors to submit but reserves approval and publishing for owners', () => {
    expect(canTransitionCampaign('draft', 'submitted', 'contributor')).toBe(true);
    expect(canTransitionCampaign('submitted', 'approved', 'contributor')).toBe(false);
    expect(canTransitionCampaign('submitted', 'approved', 'owner')).toBe(true);
    expect(canTransitionCampaign('changes_requested', 'approved', 'owner')).toBe(false);
    expect(canTransitionCampaign('approved', 'scheduled', 'owner')).toBe(true);
    expect(canTransitionCampaign('approved', 'published', 'owner')).toBe(false);
  });

  it('rejects ambiguous attachment order and oversized development relationships', () => {
    expect(normalizeCampaignInput({
      ...marketingContext,
      title: 'Ambiguous image order',
      objective: 'Keep channel attachment order deterministic.',
      variants: [{
        service: 'facebook',
        text: 'Two campaign images.',
        attachments: [
          {
            mediaId: '11111111-1111-4111-8111-111111111111',
            displayOrder: 0,
            altText: 'First image.',
          },
          {
            mediaId: '22222222-2222-4222-8222-222222222222',
            displayOrder: 0,
            altText: 'Second image.',
          },
        ],
      }],
    })).toEqual({
      ok: false,
      message: 'Each campaign image needs a unique display order.',
    });

    expect(normalizeCampaignInput({
      ...marketingContext,
      title: 'Too many links',
      objective: 'Keep campaign relationships intentionally bounded.',
      variants: [{ service: 'facebook', text: 'A campaign.' }],
      associations: Array.from({ length: 13 }, (_, index) => ({
        kind: 'feature',
        externalKey: `feature-${index}`,
      })),
    })).toEqual({
      ok: false,
      message: 'A campaign can include at most 12 development associations.',
    });
  });

  it('does not expose a private derivative through otherwise reusable media', () => {
    const media = {
      ingesting_contributor_id: 'contributor-a',
      review_state: 'public',
    } as never;
    const access = {
      isOwner: false,
      user: { id: 'contributor-b' },
    } as never;

    expect(() => assertDerivativeAccess(
      media,
      { exposure: 'private' } as never,
      access,
    )).toThrow('Campaign media access denied.');
    expect(() => assertDerivativeAccess(
      media,
      { exposure: 'public' } as never,
      access,
    )).not.toThrow();

    expect(getVisibleCampaignDerivatives(
      media,
      [
        { id: 'private-derivative', exposure: 'private' } as never,
        { id: 'public-derivative', exposure: 'public' } as never,
      ],
      access,
    )).toEqual([
      expect.objectContaining({ id: 'public-derivative' }),
    ]);
  });
});
