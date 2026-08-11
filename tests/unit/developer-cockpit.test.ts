import { describe, expect, it } from 'vitest';

import {
  canTransitionCampaign,
  normalizeCampaignInput,
  normalizeSiteProposalInput,
} from '@/features/developer-cockpit/model';
import { resolveDeveloperContributionScopes } from '@/features/developer-access/model';

describe('developer contribution cockpit', () => {
  it('keeps new contribution powers least-privilege while owners retain every approval boundary', () => {
    expect(resolveDeveloperContributionScopes({
      isOwner: false,
      profileStatus: 'active',
      canDraftCampaigns: false,
      canProposeSiteContent: false,
    })).toEqual(['assets.submit', 'assets.review']);

    expect(resolveDeveloperContributionScopes({
      isOwner: false,
      profileStatus: 'active',
      canDraftCampaigns: true,
      canProposeSiteContent: true,
    })).toEqual([
      'assets.submit',
      'assets.review',
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

  it('normalizes complete channel-specific campaign packages', () => {
    expect(normalizeCampaignInput({
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
  });

  it('allows contributors to submit but reserves approval and publishing for owners', () => {
    expect(canTransitionCampaign('draft', 'submitted', 'contributor')).toBe(true);
    expect(canTransitionCampaign('submitted', 'approved', 'contributor')).toBe(false);
    expect(canTransitionCampaign('submitted', 'approved', 'owner')).toBe(true);
    expect(canTransitionCampaign('approved', 'scheduled', 'owner')).toBe(true);
    expect(canTransitionCampaign('approved', 'published', 'owner')).toBe(false);
  });
});
