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

export type SiteContentBlockSlug =
  | 'landing.hero.headline'
  | 'landing.hero.body'
  | 'landing.hero.support'
  | 'landing.demo.heading'
  | 'landing.demo.body'
  | 'about.hero.headline'
  | 'about.hero.body'
  | 'access.hero.headline'
  | 'access.hero.body'
  | 'access.creatorPool.note';

export interface SiteContentBlock {
  slug: SiteContentBlockSlug;
  group: 'landing' | 'about' | 'access';
  label: string;
  body: string;
  updatedAt: string | null;
}

export type LegalDocumentSlug = 'privacy' | 'terms' | 'refund' | 'contact' | 'developer-terms' | 'creator-pool';

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
  siteContentBlocks: SiteContentBlock[];
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

export const DEFAULT_SITE_CONTENT_BLOCKS: SiteContentBlock[] = [
  {
    slug: 'landing.hero.headline',
    group: 'landing',
    label: 'Landing hero headline',
    body: 'Build cards faster. Generate complete sets. Shape the forge together.',
    updatedAt: null,
  },
  {
    slug: 'landing.hero.body',
    group: 'landing',
    label: 'Landing hero body',
    body: 'CardForge helps creators turn card ideas into full, export-ready sets while the community helps build the shared library that powers the studio.',
    updatedAt: null,
  },
  {
    slug: 'landing.hero.support',
    group: 'landing',
    label: 'Landing hero support line',
    body: 'The fantasy forge is the doorway; underneath is a serious production workflow for reusable templates, structured data, bulk generation, and clean exports.',
    updatedAt: null,
  },
  {
    slug: 'landing.demo.heading',
    group: 'landing',
    label: 'Landing demo-seat headline',
    body: 'Free demo seats are open for the current wave.',
    updatedAt: null,
  },
  {
    slug: 'landing.demo.body',
    group: 'landing',
    label: 'Landing demo-seat body',
    body: 'Claiming a Founder Beta seat unlocks clean export access for the demo window while seats remain open. It is the fastest way to test the production workflow before CardForge moves into wider paid access.',
    updatedAt: null,
  },
  {
    slug: 'about.hero.headline',
    group: 'about',
    label: 'About page headline',
    body: 'A fantasy-forged studio for serious card production.',
    updatedAt: null,
  },
  {
    slug: 'about.hero.body',
    group: 'about',
    label: 'About page body',
    body: 'CardForge helps creators design reusable card systems, generate complete sets from structured data, and export clean files. The forge theme gives the product a memorable doorway; the deeper promise is a practical workbench for creators who need repeatable layouts, shared assets, and faster iteration.',
    updatedAt: null,
  },
  {
    slug: 'access.hero.headline',
    group: 'access',
    label: 'Access page headline',
    body: 'Start free, claim a demo seat, then unlock cleaner production workflows.',
    updatedAt: null,
  },
  {
    slug: 'access.hero.body',
    group: 'access',
    label: 'Access page body',
    body: 'CardForge is in beta, so access is intentionally staged. New users can explore the studio first, claim Founder Beta access when seats are open, and move toward Creator Pass or developer participation as the platform matures.',
    updatedAt: null,
  },
  {
    slug: 'access.creatorPool.note',
    group: 'access',
    label: 'Access creator-pool note',
    body: 'Developer profit-sharing language is a future creator-pool plan, not active payout infrastructure yet.',
    updatedAt: null,
  },
];

const privacyBody = `CardForge Studio is a local-first card creation tool. Card projects, imported data, generated previews, personal uploads, and export settings are designed to stay in your browser storage or downloaded project files unless you choose to submit something to the platform or CardForge introduces an explicit cloud save feature.

We use account and infrastructure providers to identify signed-in users, unlock access, run the site, protect owner/developer tools, process future payments, and store shared platform records. Those records may include account identifiers, email addresses, optional first and last names, entitlement status, Founder Beta claims, roadmap votes, feature suggestions, developer profiles, developer submissions, developer votes, asset registry records, legal documents, and owner settings.

Developer submissions, public source files, and published library assets are intentionally shared with the review pipeline and may become visible to other users. Do not upload confidential files, private client work, or content you do not have permission to share.

CardForge does not sell user project files. We do not intentionally collect information from children under 13. If you need privacy support, contact the support email listed on this site.`;

const termsBody = `CardForge Studio lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access. You are responsible for the content, artwork, data, trademarks, and intellectual property you bring into the tool.

You keep ownership of the content you create. By using CardForge, you grant CardForge the limited permission needed to operate the service, render previews, process exports, preserve local/project state, and, when you submit assets to the developer pipeline, review, display, publish, archive, and maintain those submitted assets as part of the shared library.

The product is in active beta. Features, pricing, access levels, export behavior, developer rules, and library availability may change as the service develops. Do not use CardForge for unlawful content, infringing content, malicious uploads, harassment, or activity that harms the platform or other users.

CardForge is a creative production tool, not a print vendor or legal clearance service. Always proof exports, keep your own backups, and confirm printer/manufacturer requirements before production.`;

const refundBody = `CardForge is currently operating as an early beta. Founder Beta access, free demo seats, paid access, subscriptions, checkout behavior, and refund rules may differ by launch phase and will be shown before public self-serve billing is enabled.

When paid billing is active, cancellation and refund requests should be sent to the support email listed on this site and may also depend on the payment provider's records. Downloaded digital files, export access that has already been used, and time-limited beta passes may have limited refund availability unless required by law or approved by CardForge support.

If you have a billing, cancellation, or export-access issue, contact support with the account email, transaction reference if available, and a short description of the issue.`;

const contactBody = `For support, beta access, developer account requests, legal questions, billing questions, account problems, or asset pipeline concerns, contact the support email listed on this site.

For fastest help, include the account email, the page or workflow where the issue happened, what you expected, what actually happened, and whether the issue involves a local project, export, template, developer asset, or billing/access state.

CardForge is in active development. Support responses are handled by the CardForge owner/operator until a larger support process is introduced.`;

const developerTermsBody = `Forge Review is the developer contribution path for CardForge. Developers may submit templates, icons, dividers, textures, frames, source files, element recipes, and other approved creative assets into the shared review pipeline.

Only submit work you created, own, licensed, or have clear permission to contribute. Do not submit confidential work, client-restricted files, AI-generated material that violates its source license, infringing content, malware, deceptive files, or anything you would not want reviewed, archived, published, or used by other CardForge users.

Submitted assets move through the same platform pipeline as starter assets: draft, submitted, voting, publish candidate, published, archived, or rejected. Developer votes, owner rules, quality scores, access tiers, and platform caps can affect where an asset appears. Published assets may remain available after a developer leaves so existing users and templates do not break.

Contributor records are durable platform history. Deleting or disabling an account should not delete prior votes, source-file references, registry records, published assets, or contribution attribution snapshots. Owners may archive, remove, or edit platform availability for safety, quality, legal, licensing, or operational reasons.

These developer terms describe the current contribution model and do not create employment, partnership, guaranteed payment, or ownership of CardForge unless a separate written agreement says so.`;

const creatorPoolBody = `CardForge is building toward a creator pool that can share a portion of eligible platform profit with eligible active developers. The current planning target is a configurable percentage, currently represented in the product as 10% by default, split evenly among eligible active developers after financial launch systems are ready.

The creator pool is not active payout infrastructure today. It is not stock, equity, a security, employment, partnership, a wage promise, or guaranteed income. It depends on future billing, refund handling, tax handling, payout provider setup, creator eligibility rules, legal review, and owner-published program terms.

The owner console controls the visible planning percentage, developer eligibility flags, vote weights, voting rules, monthly contribution expectations, and access-tier rules. Changes should be published clearly before they affect active developers.

Until payout systems and final legal terms are live, treat creator-pool language as the product direction for the collective, not as a payable balance or enforceable distribution schedule.`;

export const DEFAULT_LEGAL_DOCUMENTS: LegalDocument[] = [
  { slug: 'privacy', title: 'Privacy Policy', body: privacyBody, publishedAt: null },
  { slug: 'terms', title: 'Terms of Service', body: termsBody, publishedAt: null },
  { slug: 'refund', title: 'Refund and Cancellation Policy', body: refundBody, publishedAt: null },
  { slug: 'contact', title: 'Contact and Support', body: contactBody, publishedAt: null },
  { slug: 'developer-terms', title: 'Developer Contributor Terms', body: developerTermsBody, publishedAt: null },
  { slug: 'creator-pool', title: 'Creator Pool Notice', body: creatorPoolBody, publishedAt: null },
];

const legalSlugs = new Set<LegalDocumentSlug>(DEFAULT_LEGAL_DOCUMENTS.map((document) => document.slug));
const siteContentSlugs = new Set<SiteContentBlockSlug>(DEFAULT_SITE_CONTENT_BLOCKS.map((block) => block.slug));

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

export type SiteContentBlockInputResult =
  | { ok: true; value: Pick<SiteContentBlock, 'slug' | 'body'> }
  | { ok: false; message: string };

export const normalizeSiteContentBlockInput = (value: {
  slug?: unknown;
  body?: unknown;
}): SiteContentBlockInputResult => {
  const slug = typeof value.slug === 'string' ? value.slug : '';
  if (!siteContentSlugs.has(slug as SiteContentBlockSlug)) {
    return { ok: false, message: 'Unknown site copy block.' };
  }

  const body = typeof value.body === 'string' ? value.body.trim() : '';
  if (!body) return { ok: false, message: 'Site copy is required.' };
  if (body.length > 800) return { ok: false, message: 'Site copy must be 800 characters or fewer.' };

  return {
    ok: true,
    value: { slug: slug as SiteContentBlockSlug, body },
  };
};

export const normalizeLegalDocumentInput = (value: {
  slug?: unknown;
  title?: unknown;
  body?: unknown;
}): LegalDocumentInputResult => {
  const slug = typeof value.slug === 'string' ? value.slug : '';
  if (!legalSlugs.has(slug as LegalDocumentSlug)) {
    return { ok: false, message: 'Unknown legal document.' };
  }

  const title = normalizeText(value.title);
  const body = typeof value.body === 'string' ? value.body.trim() : '';

  if (!title) return { ok: false, message: 'Legal document title is required.' };
  if (!body) return { ok: false, message: 'Legal document body is required.' };

  return {
    ok: true,
    value: { slug: slug as LegalDocumentSlug, title, body },
  };
};

export const getDefaultLegalDocument = (slug: LegalDocumentSlug): LegalDocument =>
  DEFAULT_LEGAL_DOCUMENTS.find((document) => document.slug === slug) ?? DEFAULT_LEGAL_DOCUMENTS[0];

export const getDefaultSiteContentBlock = (slug: SiteContentBlockSlug): SiteContentBlock =>
  DEFAULT_SITE_CONTENT_BLOCKS.find((block) => block.slug === slug) ?? DEFAULT_SITE_CONTENT_BLOCKS[0];

export const createSiteContentMap = (blocks: SiteContentBlock[]): Record<SiteContentBlockSlug, string> =>
  Object.fromEntries(
    DEFAULT_SITE_CONTENT_BLOCKS.map((defaultBlock) => {
      const block = blocks.find((candidate) => candidate.slug === defaultBlock.slug);
      return [defaultBlock.slug, block?.body || defaultBlock.body];
    })
  ) as Record<SiteContentBlockSlug, string>;
