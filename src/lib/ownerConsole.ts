export interface OwnerSettings {
  businessName: string;
  ownerName: string;
  supportEmail: string;
  supportPhone: string;
  websiteUrl: string;
}

export interface SiteMechanicsSettings {
  maxActiveUserRoadmapItems: number;
  maxRoadmapSuggestionLength: number;
  roadmapNegativeSignalMinTotalVotes: number;
  roadmapNegativeSignalMinDownvotePercent: number;
}

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

export interface OwnerRoadmapItem {
  id: string;
  title: string;
  description: string | null;
  itemType: 'roi_checkpoint' | 'feature' | 'shipped_update';
  status: 'planned' | 'in_progress' | 'testing' | 'shipped' | 'archived_negative_signal';
  source: 'official' | 'user';
  visibleMonth: string;
  targetMrrCents: number | null;
  monthlyCostCents: number | null;
  shippedAt: string | null;
}

export interface OwnerDatabaseMetrics {
  databaseSizeBytes: number;
  cardforgeTableSizeBytes: number;
  storageSizeBytes: number;
  assetRegistryCount: number;
  developerSubmissionCount: number;
  founderBetaClaimCount: number;
}

export type LegalDocumentSlug = 'privacy' | 'terms' | 'refund' | 'contact';

export interface LegalDocument {
  slug: LegalDocumentSlug;
  title: string;
  body: string;
  publishedAt: string | null;
}

export interface OwnerConsolePayload {
  configured: boolean;
  settings: OwnerSettings;
  siteMechanics: SiteMechanicsSettings;
  legalDocuments: LegalDocument[];
  founderBetaCampaign: FounderBetaCampaign;
  founderBetaClaims: FounderBetaClaim[];
  roadmapItems: OwnerRoadmapItem[];
  databaseMetrics: OwnerDatabaseMetrics | null;
}

export const DEFAULT_OWNER_SETTINGS: OwnerSettings = {
  businessName: 'CardForge Studio',
  ownerName: 'Cameron Locke',
  supportEmail: 'Cameron.r.locke96@gmail.com',
  supportPhone: '',
  websiteUrl: 'http://localhost:9002',
};

export const DEFAULT_SITE_MECHANICS_SETTINGS: SiteMechanicsSettings = {
  maxActiveUserRoadmapItems: 50,
  maxRoadmapSuggestionLength: 200,
  roadmapNegativeSignalMinTotalVotes: 20,
  roadmapNegativeSignalMinDownvotePercent: 51,
};

export const DEFAULT_FOUNDER_BETA_CAMPAIGN: FounderBetaCampaign = {
  id: 'founder_beta',
  enabled: true,
  publicSlotCap: 300,
  releaseSlotCap: 100,
  claimedSlots: 0,
  accessDays: 90,
  autoGrant: true,
  waitlistEnabled: true,
  campaignTitle: 'Founder Beta Pass',
  landingMessage: 'Founder Beta is open first come, first served for the first 300 creators.',
  accountBadgeLabel: 'Founder Beta Pass',
  exportGateMessage: 'Founder Beta creators get 90 days of clean export access while helping shape CardForge.',
  stripeCouponId: '',
  stripePromotionCode: '',
  updatedAt: null,
};

const privacyBody = `CardForge Studio is a local-first card creation tool. The studio is designed so card projects, imported data, generated previews, and custom project files stay in your browser storage or downloaded files unless a future cloud save feature is explicitly introduced.

We use account providers to identify signed-in users, unlock export access, and protect owner/developer tools. We may use lightweight database records for roadmap votes, feature suggestions, beta feedback, legal settings, and account-related product status.

We do not sell user project files. We do not intentionally collect information from children under 13. If you need privacy support, contact the support email listed on this site.`;

const termsBody = `CardForge Studio lets users create templates, generate previews, and export content according to their account access. You are responsible for the content, artwork, data, and intellectual property you bring into the tool.

The product is in active beta. Features, pricing, access levels, and export behavior may change as the service develops. Do not use CardForge for unlawful content or activity.

By using CardForge, you agree to use the service responsibly and to keep your own backups of local-first project data.`;

const refundBody = `CardForge is currently operating as an early beta. Paid subscription and refund rules will be finalized before public self-serve billing launches.

If you have a billing, cancellation, or export-access issue, contact the support email listed on this site.`;

const contactBody = `For support, beta access, developer account requests, legal questions, or billing questions, contact the support email listed on this site.`;

export const DEFAULT_LEGAL_DOCUMENTS: LegalDocument[] = [
  { slug: 'privacy', title: 'Privacy Policy', body: privacyBody, publishedAt: null },
  { slug: 'terms', title: 'Terms of Service', body: termsBody, publishedAt: null },
  { slug: 'refund', title: 'Refund and Cancellation Policy', body: refundBody, publishedAt: null },
  { slug: 'contact', title: 'Contact and Support', body: contactBody, publishedAt: null },
];

const legalSlugs = new Set<LegalDocumentSlug>(DEFAULT_LEGAL_DOCUMENTS.map((document) => document.slug));

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ') : '';

const normalizeLongText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const normalizeInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
};

const normalizeBoundedInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return rounded >= min && rounded <= max ? rounded : fallback;
};

export const normalizeOwnerSettingsInput = (value: Partial<Record<keyof OwnerSettings, unknown>>): OwnerSettings => ({
  businessName: normalizeText(value.businessName) || DEFAULT_OWNER_SETTINGS.businessName,
  ownerName: normalizeText(value.ownerName) || DEFAULT_OWNER_SETTINGS.ownerName,
  supportEmail: normalizeText(value.supportEmail) || DEFAULT_OWNER_SETTINGS.supportEmail,
  supportPhone: normalizeText(value.supportPhone) || DEFAULT_OWNER_SETTINGS.supportPhone,
  websiteUrl: normalizeText(value.websiteUrl) || DEFAULT_OWNER_SETTINGS.websiteUrl,
});

export const normalizeSiteMechanicsSettingsInput = (
  value: Partial<Record<keyof SiteMechanicsSettings, unknown>>
): SiteMechanicsSettings => ({
  maxActiveUserRoadmapItems: normalizeBoundedInteger(
    value.maxActiveUserRoadmapItems,
    DEFAULT_SITE_MECHANICS_SETTINGS.maxActiveUserRoadmapItems,
    1,
    500
  ),
  maxRoadmapSuggestionLength: normalizeBoundedInteger(
    value.maxRoadmapSuggestionLength,
    DEFAULT_SITE_MECHANICS_SETTINGS.maxRoadmapSuggestionLength,
    40,
    500
  ),
  roadmapNegativeSignalMinTotalVotes: normalizeBoundedInteger(
    value.roadmapNegativeSignalMinTotalVotes,
    DEFAULT_SITE_MECHANICS_SETTINGS.roadmapNegativeSignalMinTotalVotes,
    1,
    1000
  ),
  roadmapNegativeSignalMinDownvotePercent: normalizeBoundedInteger(
    value.roadmapNegativeSignalMinDownvotePercent,
    DEFAULT_SITE_MECHANICS_SETTINGS.roadmapNegativeSignalMinDownvotePercent,
    1,
    100
  ),
});

export const normalizeFounderBetaCampaignInput = (
  value: Partial<Record<keyof FounderBetaCampaign, unknown>>
): Omit<FounderBetaCampaign, 'id' | 'claimedSlots' | 'updatedAt'> => {
  const publicSlotCap = normalizeInteger(value.publicSlotCap, DEFAULT_FOUNDER_BETA_CAMPAIGN.publicSlotCap, 1, 10000);
  const releaseSlotCap = normalizeInteger(value.releaseSlotCap, DEFAULT_FOUNDER_BETA_CAMPAIGN.releaseSlotCap, 0, publicSlotCap);

  return {
    enabled: value.enabled === undefined ? DEFAULT_FOUNDER_BETA_CAMPAIGN.enabled : value.enabled === true,
    publicSlotCap,
    releaseSlotCap,
    accessDays: normalizeInteger(value.accessDays, DEFAULT_FOUNDER_BETA_CAMPAIGN.accessDays, 1, 365),
    autoGrant: value.autoGrant === undefined ? DEFAULT_FOUNDER_BETA_CAMPAIGN.autoGrant : value.autoGrant === true,
    waitlistEnabled: value.waitlistEnabled === undefined ? DEFAULT_FOUNDER_BETA_CAMPAIGN.waitlistEnabled : value.waitlistEnabled === true,
    campaignTitle: normalizeText(value.campaignTitle).slice(0, 80) || DEFAULT_FOUNDER_BETA_CAMPAIGN.campaignTitle,
    landingMessage: normalizeLongText(value.landingMessage).slice(0, 240) || DEFAULT_FOUNDER_BETA_CAMPAIGN.landingMessage,
    accountBadgeLabel: normalizeText(value.accountBadgeLabel).slice(0, 64) || DEFAULT_FOUNDER_BETA_CAMPAIGN.accountBadgeLabel,
    exportGateMessage: normalizeLongText(value.exportGateMessage).slice(0, 240) || DEFAULT_FOUNDER_BETA_CAMPAIGN.exportGateMessage,
    stripeCouponId: normalizeText(value.stripeCouponId).slice(0, 120),
    stripePromotionCode: normalizeText(value.stripePromotionCode).slice(0, 80).toUpperCase(),
  };
};

export const normalizeOwnerRoadmapStatusInput = (value: unknown): OwnerRoadmapItem['status'] | null =>
  value === 'planned'
  || value === 'in_progress'
  || value === 'testing'
  || value === 'shipped'
  || value === 'archived_negative_signal'
    ? value
    : null;

export type LegalDocumentInputResult =
  | { ok: true; value: Pick<LegalDocument, 'slug' | 'title' | 'body'> }
  | { ok: false; message: string };

export const normalizeLegalDocumentInput = (value: {
  slug?: unknown;
  title?: unknown;
  body?: unknown;
}): LegalDocumentInputResult => {
  const slug = value.slug;
  if (slug !== 'privacy' && slug !== 'terms' && slug !== 'refund' && slug !== 'contact') {
    return { ok: false, message: 'Unknown legal document.' };
  }

  const title = normalizeText(value.title);
  const body = typeof value.body === 'string' ? value.body.trim() : '';

  if (!title) return { ok: false, message: 'Legal document title is required.' };
  if (!body) return { ok: false, message: 'Legal document body is required.' };
  if (!legalSlugs.has(slug)) return { ok: false, message: 'Unknown legal document.' };

  return {
    ok: true,
    value: { slug, title, body },
  };
};

export const getDefaultLegalDocument = (slug: LegalDocumentSlug): LegalDocument =>
  DEFAULT_LEGAL_DOCUMENTS.find((document) => document.slug === slug) ?? DEFAULT_LEGAL_DOCUMENTS[0];
