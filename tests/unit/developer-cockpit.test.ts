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
      sourceReference: 'Jam 42',
      licenseNotes: 'CardForge-owned capture.',
      requestedPublishAt: '2026-08-02T18:00:00.000Z',
      variants: [{
        service: 'facebook',
        text: '  Build one card, then forge the set.  ',
        media: [{
          sourceBucket: 'cardforge-social-sources',
          sourcePath: 'dev-1/capture.webp',
          alt: 'CardForge Studio showing a generated card set.',
        }],
      }],
    })).toEqual({
      ok: true,
      value: {
        title: 'Founder workflow proof',
        objective: 'Show the full card-set workflow.',
        destinationUrl: 'https://cardforges.com/',
        sourceReference: 'Jam 42',
        licenseNotes: 'CardForge-owned capture.',
        requestedPublishAt: '2026-08-02T18:00:00.000Z',
        variants: [{
          service: 'facebook',
          text: 'Build one card, then forge the set.',
          media: [{
            sourceBucket: 'cardforge-social-sources',
            sourcePath: 'dev-1/capture.webp',
            publicUrl: null,
            alt: 'CardForge Studio showing a generated card set.',
          }],
        }],
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
  });

  it('allows contributors to submit but reserves approval and publishing for owners', () => {
    expect(canTransitionCampaign('draft', 'submitted', 'contributor')).toBe(true);
    expect(canTransitionCampaign('submitted', 'approved', 'contributor')).toBe(false);
    expect(canTransitionCampaign('submitted', 'approved', 'owner')).toBe(true);
    expect(canTransitionCampaign('approved', 'scheduled', 'owner')).toBe(true);
    expect(canTransitionCampaign('approved', 'published', 'owner')).toBe(false);
  });
});
