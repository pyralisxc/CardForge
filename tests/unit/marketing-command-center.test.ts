import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MARKETING_STRATEGY,
  MARKETING_AUDIENCES,
  MARKETING_CONTENT_PILLARS,
  normalizeMarketingCampaignInput,
  normalizeMarketingDestinationInput,
  normalizeMarketingStrategyInput,
} from '@/features/marketing/model';

describe('marketing command center contracts', () => {
  it('ships with one focused primary market and one adjacent validation market', () => {
    expect(DEFAULT_MARKETING_STRATEGY.primaryAudience).toBe('tabletop-designers');
    expect(DEFAULT_MARKETING_STRATEGY.validationAudience).toBe('deck-creators');
    expect(DEFAULT_MARKETING_STRATEGY.primaryAudience).not.toBe(
      DEFAULT_MARKETING_STRATEGY.validationAudience,
    );
    expect(MARKETING_AUDIENCES.map((audience) => audience.id)).toContain(
      DEFAULT_MARKETING_STRATEGY.primaryAudience,
    );
    expect(DEFAULT_MARKETING_STRATEGY.enabledPillars).toEqual(
      MARKETING_CONTENT_PILLARS.map((pillar) => pillar.id),
    );
  });

  it('normalizes an owner-editable strategy without accepting unknown markets', () => {
    expect(normalizeMarketingStrategyInput({
      primaryAudience: 'tabletop-designers',
      validationAudience: 'deck-creators',
      positioning: '  Turn one card design into a coherent, printable set.  ',
      offer: ' Founder access ',
      defaultCallToAction: ' Enter the Studio ',
      enabledPillars: ['product-proof', 'creator-education'],
      approvedClaims: ['Bulk-generate a set', 'Bulk-generate a set'],
      prohibitedClaims: ['Do not promise automatic printing'],
    })).toEqual({
      ok: true,
      value: {
        primaryAudience: 'tabletop-designers',
        validationAudience: 'deck-creators',
        positioning: 'Turn one card design into a coherent, printable set.',
        offer: 'Founder access',
        defaultCallToAction: 'Enter the Studio',
        enabledPillars: ['product-proof', 'creator-education'],
        approvedClaims: ['Bulk-generate a set'],
        prohibitedClaims: ['Do not promise automatic printing'],
      },
    });

    expect(normalizeMarketingStrategyInput({
      ...DEFAULT_MARKETING_STRATEGY,
      primaryAudience: 'everyone',
    })).toEqual({ ok: false, message: 'Choose a supported primary market.' });
  });

  it('keeps community destinations manual and records their participation rules', () => {
    expect(normalizeMarketingDestinationInput({
      name: '  Break My Game Discord ',
      service: 'discord',
      kind: 'community',
      url: 'https://www.breakmygame.com/',
      rulesUrl: 'https://www.breakmygame.com/code-of-conduct',
      rulesSummary: ' Participate and help before sharing CardForge. ',
      postingGuidance: 'Ask for prototype workflow feedback.',
      audienceKeys: ['tabletop-designers'],
      active: true,
    })).toEqual({
      ok: true,
      value: {
        name: 'Break My Game Discord',
        service: 'discord',
        kind: 'community',
        provider: 'manual',
        publishingMode: 'manual',
        externalAccountId: '',
        url: 'https://www.breakmygame.com/',
        rulesUrl: 'https://www.breakmygame.com/code-of-conduct',
        rulesSummary: 'Participate and help before sharing CardForge.',
        postingGuidance: 'Ask for prototype workflow feedback.',
        audienceKeys: ['tabletop-designers'],
        active: true,
      },
    });

    expect(normalizeMarketingDestinationInput({
      name: 'Tabletop group',
      service: 'facebook',
      kind: 'community',
      provider: 'meta',
      publishingMode: 'automatic',
      url: 'https://facebook.com/groups/example',
      rulesSummary: 'Read the rules.',
    })).toEqual({
      ok: false,
      message: 'Community destinations must use guided manual publishing.',
    });

    expect(normalizeMarketingDestinationInput({
      name: 'Connected Facebook Page',
      service: 'facebook',
      kind: 'owned',
      provider: 'meta',
      publishingMode: 'automatic',
      externalAccountId: 'page-123',
    })).toEqual({
      ok: false,
      message: 'Connected Meta destinations are managed through Connect Meta.',
    });
  });

  it('normalizes campaign containers independently from individual content submissions', () => {
    expect(normalizeMarketingCampaignInput({
      name: '  Founder Beta Introduction ',
      objective: ' Prove that one design can become a coherent set. ',
      audienceKey: 'tabletop-designers',
      offer: 'Founder Beta access',
      status: 'active',
      startsOn: '2026-08-16',
      endsOn: '2026-09-30',
      successMetric: 'Qualified Studio visits and completed exports.',
      utmCampaign: ' Founder Beta ',
    })).toEqual({
      ok: true,
      value: {
        name: 'Founder Beta Introduction',
        objective: 'Prove that one design can become a coherent set.',
        audienceKey: 'tabletop-designers',
        offer: 'Founder Beta access',
        status: 'active',
        startsOn: '2026-08-16',
        endsOn: '2026-09-30',
        successMetric: 'Qualified Studio visits and completed exports.',
        utmCampaign: 'founder_beta',
      },
    });

    expect(normalizeMarketingCampaignInput({
      name: 'Broken window',
      objective: 'This end date precedes the start date.',
      audienceKey: 'tabletop-designers',
      status: 'planning',
      startsOn: '2026-09-30',
      endsOn: '2026-08-16',
      utmCampaign: 'broken_window',
    })).toEqual({
      ok: false,
      message: 'Campaign end date cannot be before its start date.',
    });
  });
});
