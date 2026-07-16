import { describe, expect, it } from 'vitest';

import {
  buildBillingReconciliationDescription,
  DEFAULT_FOUNDER_BETA_CAMPAIGN,
  normalizeFounderBetaCampaignInput,
  reconcileFounderBetaCampaignCopy,
} from '@/features/owner/lib/ownerConsole';

describe('owner console data rules', () => {
  it('shows every live billing reconciliation proof in the owner notification', () => {
    expect(buildBillingReconciliationDescription({
      checked: 1,
      repaired: 0,
      unchanged: 1,
      missingClerkUser: 0,
      mappingRepaired: 0,
      needsCustomerSignIn: 0,
      ambiguousClerkUsers: 0,
      ledgerCreated: 1,
      missingLedger: 0,
      hasMore: false,
    })).toBe('1 subscription checked; 1 ledger baseline created; 0 entitlements repaired; 0 account mappings repaired; 1 unchanged; 0 missing Clerk users; 0 subscriptions missing ledger coverage.');
  });

  it('tells the owner how to recover a subscriber without charging them again', () => {
    expect(buildBillingReconciliationDescription({
      checked: 1,
      repaired: 0,
      unchanged: 0,
      missingClerkUser: 1,
      mappingRepaired: 0,
      needsCustomerSignIn: 1,
      ambiguousClerkUsers: 0,
      ledgerCreated: 0,
      missingLedger: 0,
      hasMore: false,
    })).toContain('Ask the customer to sign in or register with their Stripe email; they should not purchase again.');
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
