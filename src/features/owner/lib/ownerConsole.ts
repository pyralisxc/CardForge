import type { ContactRequest } from '@/features/contact/client';
import type { LegalDocument } from '@/features/legal/client';
import type {
  SiteContentBlock,
  SiteOperatorSettings,
} from '@/features/public-site/client';
import type {
  RoadmapAdminItem,
  RoadmapSettings,
} from '@/features/roadmap/client';

export interface FounderBetaCampaign {
  id: 'founder_beta';
  enabled: boolean;
  publicSlotCap: number;
  releaseSlotCap: number;
  claimedSlots: number;
  accessDays: number;
  autoGrant: boolean;
  waitlistEnabled: boolean;
  campaignTitle: string;
  landingMessage: string;
  accountBadgeLabel: string;
  exportGateMessage: string;
  stripeCouponId: string;
  stripePromotionCode: string;
  updatedAt: string | null;
}

export interface FounderBetaClaim {
  id: string;
  email: string | null;
  status: 'active' | 'revoked';
  claimedAt: string;
  accessExpiresAt: string;
}

export interface OwnerDatabaseMetrics {
  databaseSizeBytes: number;
  cardforgeTableSizeBytes: number;
  storageSizeBytes: number;
  assetRegistryCount: number;
  developerSubmissionCount: number;
  founderBetaClaimCount: number;
}

export interface OwnerConsolePayload {
  configured: boolean;
  settings: SiteOperatorSettings;
  siteMechanics: RoadmapSettings;
  siteContentBlocks: SiteContentBlock[];
  legalDocuments: LegalDocument[];
  founderBetaCampaign: FounderBetaCampaign;
  founderBetaClaims: FounderBetaClaim[];
  roadmapItems: RoadmapAdminItem[];
  databaseMetrics: OwnerDatabaseMetrics | null;
  contactRequests: ContactRequest[];
}

export const DEFAULT_FOUNDER_BETA_CAMPAIGN: FounderBetaCampaign = {
  id: 'founder_beta',
  enabled: true,
  publicSlotCap: 25,
  releaseSlotCap: 25,
  claimedSlots: 0,
  accessDays: 90,
  autoGrant: true,
  waitlistEnabled: true,
  campaignTitle: 'Founder Beta Pass',
  landingMessage: 'Founder Beta is open first come, first served for the first 25 creators.',
  accountBadgeLabel: 'Founder Beta Pass',
  exportGateMessage: 'Founder Beta creators get 90 days of clean export access while helping shape CardForge.',
  stripeCouponId: '',
  stripePromotionCode: '',
  updatedAt: null,
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ') : '';

const normalizeLongText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const normalizeInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
};

export const normalizeFounderBetaCampaignInput = (
  value: Partial<Record<keyof FounderBetaCampaign, unknown>>,
): Omit<FounderBetaCampaign, 'id' | 'claimedSlots' | 'updatedAt'> => {
  const publicSlotCap = normalizeInteger(
    value.publicSlotCap,
    DEFAULT_FOUNDER_BETA_CAMPAIGN.publicSlotCap,
    1,
    10000,
  );
  const releaseSlotCap = normalizeInteger(
    value.releaseSlotCap,
    DEFAULT_FOUNDER_BETA_CAMPAIGN.releaseSlotCap,
    0,
    publicSlotCap,
  );

  return {
    enabled: value.enabled === undefined ? DEFAULT_FOUNDER_BETA_CAMPAIGN.enabled : value.enabled === true,
    publicSlotCap,
    releaseSlotCap,
    accessDays: normalizeInteger(value.accessDays, DEFAULT_FOUNDER_BETA_CAMPAIGN.accessDays, 1, 365),
    autoGrant: value.autoGrant === undefined ? DEFAULT_FOUNDER_BETA_CAMPAIGN.autoGrant : value.autoGrant === true,
    waitlistEnabled: value.waitlistEnabled === undefined
      ? DEFAULT_FOUNDER_BETA_CAMPAIGN.waitlistEnabled
      : value.waitlistEnabled === true,
    campaignTitle: normalizeText(value.campaignTitle).slice(0, 80)
      || DEFAULT_FOUNDER_BETA_CAMPAIGN.campaignTitle,
    landingMessage: normalizeLongText(value.landingMessage).slice(0, 240)
      || DEFAULT_FOUNDER_BETA_CAMPAIGN.landingMessage,
    accountBadgeLabel: normalizeText(value.accountBadgeLabel).slice(0, 64)
      || DEFAULT_FOUNDER_BETA_CAMPAIGN.accountBadgeLabel,
    exportGateMessage: normalizeLongText(value.exportGateMessage).slice(0, 240)
      || DEFAULT_FOUNDER_BETA_CAMPAIGN.exportGateMessage,
    stripeCouponId: normalizeText(value.stripeCouponId).slice(0, 120),
    stripePromotionCode: normalizeText(value.stripePromotionCode).slice(0, 80).toUpperCase(),
  };
};

export const reconcileFounderBetaCampaignCopy = (
  campaign: FounderBetaCampaign,
): FounderBetaCampaign => {
  const visibleCap = campaign.releaseSlotCap > 0
    ? campaign.releaseSlotCap
    : campaign.publicSlotCap;
  return {
    ...campaign,
    landingMessage: campaign.landingMessage.replace(
      /\bfirst\s+\d+\s+creators\b/i,
      `first ${visibleCap} creators`,
    ),
  };
};

export interface BillingReconciliationResult {
  checked: number;
  repaired: number;
  unchanged: number;
  missingClerkUser: number;
  mappingRepaired: number;
  needsCustomerSignIn: number;
  ambiguousClerkUsers: number;
  ledgerCreated: number;
  missingLedger: number;
  hasMore: boolean;
}

export const buildBillingReconciliationDescription = (
  result: BillingReconciliationResult,
): string => {
  const subscriptionLabel = result.checked === 1 ? 'subscription' : 'subscriptions';
  const baselineLabel = result.ledgerCreated === 1 ? 'baseline' : 'baselines';
  const signInAction = result.needsCustomerSignIn > 0
    ? ' Ask the customer to sign in or register with their Stripe email; they should not purchase again.'
    : '';
  const ambiguousAction = result.ambiguousClerkUsers > 0
    ? ' Multiple production accounts matched at least one Stripe email; no mapping was guessed.'
    : '';
  return `${result.checked} ${subscriptionLabel} checked; ${result.ledgerCreated} ledger ${baselineLabel} created; ${result.repaired} entitlements repaired; ${result.mappingRepaired} account mappings repaired; ${result.unchanged} unchanged; ${result.missingClerkUser} missing Clerk users; ${result.missingLedger} subscriptions missing ledger coverage.${signInAction}${ambiguousAction}${result.hasMore ? ' Additional Stripe pages remain; run reconciliation again.' : ''}`;
};
