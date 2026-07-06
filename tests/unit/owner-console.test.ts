import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LEGAL_DOCUMENTS,
  DEFAULT_FOUNDER_BETA_CAMPAIGN,
  DEFAULT_OWNER_SETTINGS,
  DEFAULT_SITE_CONTENT_BLOCKS,
  DEFAULT_SITE_MECHANICS_SETTINGS,
  normalizeSiteContentBlockInput,
  normalizeFounderBetaCampaignInput,
  normalizeOwnerSettingsInput,
  normalizeLegalDocumentInput,
  normalizeSiteMechanicsSettingsInput,
} from '@/lib/ownerConsole';

describe('owner console data rules', () => {
  it('ships with required legal documents', () => {
    expect(DEFAULT_LEGAL_DOCUMENTS.map((document) => document.slug)).toEqual([
      'privacy',
      'terms',
      'refund',
      'contact',
      'developer-terms',
      'creator-pool',
    ]);
  });

  it('ships with owner-editable public content blocks', () => {
    expect(DEFAULT_SITE_CONTENT_BLOCKS.map((block) => block.slug)).toEqual([
      'landing.hero.headline',
      'landing.hero.body',
      'landing.hero.support',
      'landing.demo.heading',
      'landing.demo.body',
      'about.hero.headline',
      'about.hero.body',
      'access.hero.headline',
      'access.hero.body',
      'access.creatorPool.note',
    ]);
  });

  it('normalizes owner business profile settings', () => {
    expect(normalizeOwnerSettingsInput({
      businessName: '  Card Forge LLC  ',
      ownerName: '  Cameron Locke ',
      supportEmail: '  Cameron.R.Locke96@gmail.com ',
      supportPhone: '  555-0100 ',
      websiteUrl: '  https://cardforge.example ',
    })).toEqual({
      businessName: 'Card Forge LLC',
      ownerName: 'Cameron Locke',
      supportEmail: 'Cameron.R.Locke96@gmail.com',
      supportPhone: '555-0100',
      websiteUrl: 'https://cardforge.example',
    });
  });

  it('falls back to defaults for empty owner settings', () => {
    expect(normalizeOwnerSettingsInput({})).toEqual(DEFAULT_OWNER_SETTINGS);
  });

  it('normalizes owner-controlled site mechanics guardrails', () => {
    expect(normalizeSiteMechanicsSettingsInput({
      maxActiveUserRoadmapItems: '75',
      maxRoadmapSuggestionLength: '240',
      roadmapNegativeSignalMinTotalVotes: '12',
      roadmapNegativeSignalMinDownvotePercent: '65',
    })).toEqual({
      maxActiveUserRoadmapItems: 75,
      maxRoadmapSuggestionLength: 240,
      roadmapNegativeSignalMinTotalVotes: 12,
      roadmapNegativeSignalMinDownvotePercent: 65,
    });

    expect(normalizeSiteMechanicsSettingsInput({
      maxActiveUserRoadmapItems: '0',
      maxRoadmapSuggestionLength: '9000',
      roadmapNegativeSignalMinTotalVotes: '-1',
      roadmapNegativeSignalMinDownvotePercent: 'bad',
    })).toEqual(DEFAULT_SITE_MECHANICS_SETTINGS);
  });

  it('accepts only known legal documents for owner edits', () => {
    expect(normalizeLegalDocumentInput({
      slug: 'privacy',
      title: ' Privacy ',
      body: ' Updated privacy copy ',
    })).toEqual({
      ok: true,
      value: {
        slug: 'privacy',
        title: 'Privacy',
        body: 'Updated privacy copy',
      },
    });

    expect(normalizeLegalDocumentInput({
      slug: 'developer-terms',
      title: ' Developer Terms ',
      body: ' Contributor policy ',
    })).toEqual({
      ok: true,
      value: {
        slug: 'developer-terms',
        title: 'Developer Terms',
        body: 'Contributor policy',
      },
    });

    expect(normalizeLegalDocumentInput({
      slug: 'unknown',
      title: 'Nope',
      body: 'Nope',
    }).ok).toBe(false);
  });

  it('accepts only known site content blocks for owner edits', () => {
    expect(normalizeSiteContentBlockInput({
      slug: 'landing.hero.headline',
      body: '  A sharper owner-controlled headline.  ',
    })).toEqual({
      ok: true,
      value: {
        slug: 'landing.hero.headline',
        body: 'A sharper owner-controlled headline.',
      },
    });

    expect(normalizeSiteContentBlockInput({
      slug: 'new.random.page',
      body: 'No page builder from owner console.',
    }).ok).toBe(false);

    expect(normalizeSiteContentBlockInput({
      slug: 'landing.hero.body',
      body: 'x'.repeat(801),
    }).ok).toBe(false);
  });

  it('normalizes Founder Beta campaign settings and caps releases at the public slot cap', () => {
    expect(normalizeFounderBetaCampaignInput({
      enabled: true,
      publicSlotCap: '300',
      releaseSlotCap: '500',
      accessDays: '90',
      autoGrant: false,
      waitlistEnabled: true,
      campaignTitle: '  Founder Beta Pass  ',
      landingMessage: '  First come, first served for early creators.  ',
      accountBadgeLabel: '  Founder Pass  ',
      exportGateMessage: '  Claim beta export access.  ',
      stripeCouponId: '  coupon_123  ',
      stripePromotionCode: ' beta300 ',
    })).toMatchObject({
      enabled: true,
      publicSlotCap: 300,
      releaseSlotCap: 300,
      accessDays: 90,
      autoGrant: false,
      waitlistEnabled: true,
      campaignTitle: 'Founder Beta Pass',
      landingMessage: 'First come, first served for early creators.',
      accountBadgeLabel: 'Founder Pass',
      exportGateMessage: 'Claim beta export access.',
      stripeCouponId: 'coupon_123',
      stripePromotionCode: 'BETA300',
    });
  });

  it('defaults Founder Beta to 300 public slots', () => {
    expect(DEFAULT_FOUNDER_BETA_CAMPAIGN.publicSlotCap).toBe(300);
    expect(normalizeFounderBetaCampaignInput({}).publicSlotCap).toBe(300);
  });
});
