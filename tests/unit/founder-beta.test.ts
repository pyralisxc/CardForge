import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FOUNDER_BETA_CAMPAIGN,
  normalizeFounderBetaCampaignInput,
  reconcileFounderBetaCampaignCopy,
} from '@/features/account/client';

describe('Founder Beta rules', () => {
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

  it('defaults Founder Beta to the current 25-seat launch wave', () => {
    expect(DEFAULT_FOUNDER_BETA_CAMPAIGN.publicSlotCap).toBe(25);
    expect(DEFAULT_FOUNDER_BETA_CAMPAIGN.releaseSlotCap).toBe(25);
    expect(normalizeFounderBetaCampaignInput({}).publicSlotCap).toBe(25);
    expect(normalizeFounderBetaCampaignInput({}).releaseSlotCap).toBe(25);
  });

  it('keeps Founder Beta landing copy aligned with the configured wave cap', () => {
    expect(reconcileFounderBetaCampaignCopy({
      ...DEFAULT_FOUNDER_BETA_CAMPAIGN,
      publicSlotCap: 25,
      releaseSlotCap: 25,
      landingMessage: 'Founder Beta is open first come, first served for the first 100 creators.',
    }).landingMessage).toBe('Founder Beta is open first come, first served for the first 25 creators.');
  });
});
