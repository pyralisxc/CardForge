import { getBillingConfigStatus } from '@/lib/billing';
import { isClerkAuthConfigured } from '@/lib/accountEntitlement';
import {
  DEFAULT_FOUNDER_BETA_CAMPAIGN,
  DEFAULT_LEGAL_DOCUMENTS,
  DEFAULT_OWNER_SETTINGS,
  DEFAULT_SITE_MECHANICS_SETTINGS,
  type FounderBetaCampaign,
  type FounderBetaClaim,
  type LegalDocument,
  type LegalDocumentSlug,
  type OwnerConsolePayload,
  type OwnerDatabaseMetrics,
  type OwnerRoadmapItem,
  type OwnerSettings,
  type SiteMechanicsSettings,
  getDefaultLegalDocument,
  normalizeFounderBetaCampaignInput,
  normalizeLegalDocumentInput,
  normalizeOwnerRoadmapStatusInput,
  normalizeOwnerSettingsInput,
  normalizeSiteMechanicsSettingsInput,
} from '@/lib/ownerConsole';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/lib/supabaseServer';

type OwnerSettingsRow = {
  business_name: string;
  owner_name: string;
  support_email: string;
  support_phone: string;
  website_url: string;
  max_active_user_roadmap_items: number | null;
  max_roadmap_suggestion_length: number | null;
  roadmap_negative_signal_min_total_votes: number | null;
  roadmap_negative_signal_min_downvote_percent: number | null;
};

type LegalDocumentRow = {
  slug: LegalDocumentSlug;
  title: string;
  body: string;
  published_at: string | null;
};

type FounderBetaCampaignRow = {
  enabled: boolean;
  public_slot_cap: number;
  release_slot_cap: number;
  access_days: number;
  auto_grant: boolean;
  waitlist_enabled: boolean;
  campaign_title: string;
  landing_message: string;
  account_badge_label: string;
  export_gate_message: string;
  stripe_coupon_id: string;
  stripe_promotion_code: string;
  updated_at: string | null;
};

type FounderBetaClaimResultRow = {
  claimed: boolean;
  reason: string;
  access_expires_at: string | null;
  claimed_slots: number;
  release_slot_cap: number;
  public_slot_cap: number;
};

type FounderBetaClaimRow = {
  id: string;
  email: string | null;
  status: 'active' | 'revoked';
  claimed_at: string;
  access_expires_at: string;
};

type OwnerRoadmapItemRow = {
  id: string;
  title: string;
  description: string | null;
  item_type: OwnerRoadmapItem['itemType'] | null;
  status: OwnerRoadmapItem['status'];
  source: OwnerRoadmapItem['source'];
  visible_month: string | null;
  target_mrr_cents: number | null;
  monthly_cost_cents: number | null;
  shipped_at: string | null;
};

type DatabaseMetricsRow = {
  database_size_bytes: number | null;
  cardforge_table_size_bytes: number | null;
  storage_size_bytes: number | null;
  asset_registry_count: number | null;
  developer_submission_count: number | null;
  founder_beta_claim_count: number | null;
};

export class OwnerConsoleStoreError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
  }
}

const isMissingOwnerTableError = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && (error as { code?: string }).code === 'PGRST205';

const mapSettingsRow = (row: OwnerSettingsRow | null | undefined): OwnerSettings =>
  row
    ? {
        businessName: row.business_name,
        ownerName: row.owner_name,
        supportEmail: row.support_email,
        supportPhone: row.support_phone,
        websiteUrl: row.website_url,
      }
    : DEFAULT_OWNER_SETTINGS;

const mapSiteMechanicsRow = (row: OwnerSettingsRow | null | undefined): SiteMechanicsSettings =>
  row
    ? normalizeSiteMechanicsSettingsInput({
        maxActiveUserRoadmapItems: row.max_active_user_roadmap_items,
        maxRoadmapSuggestionLength: row.max_roadmap_suggestion_length,
        roadmapNegativeSignalMinTotalVotes: row.roadmap_negative_signal_min_total_votes,
        roadmapNegativeSignalMinDownvotePercent: row.roadmap_negative_signal_min_downvote_percent,
      })
    : DEFAULT_SITE_MECHANICS_SETTINGS;

const mapLegalRow = (row: LegalDocumentRow): LegalDocument => ({
  slug: row.slug,
  title: row.title,
  body: row.body,
  publishedAt: row.published_at,
});

const mapFounderBetaCampaignRow = (
  row: FounderBetaCampaignRow | null | undefined,
  claimedSlots: number
): FounderBetaCampaign => row
  ? {
      id: 'founder_beta',
      enabled: row.enabled,
      publicSlotCap: row.public_slot_cap,
      releaseSlotCap: row.release_slot_cap,
      claimedSlots,
      accessDays: row.access_days,
      autoGrant: row.auto_grant,
      waitlistEnabled: row.waitlist_enabled,
      campaignTitle: row.campaign_title,
      landingMessage: row.landing_message,
      accountBadgeLabel: row.account_badge_label,
      exportGateMessage: row.export_gate_message,
      stripeCouponId: row.stripe_coupon_id,
      stripePromotionCode: row.stripe_promotion_code,
      updatedAt: row.updated_at,
    }
  : {
      ...DEFAULT_FOUNDER_BETA_CAMPAIGN,
      claimedSlots,
    };

const getFounderBetaCampaign = async (): Promise<{ configured: boolean; campaign: FounderBetaCampaign }> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return {
      configured: false,
      campaign: DEFAULT_FOUNDER_BETA_CAMPAIGN,
    };
  }

  const [{ data: campaignRows, error: campaignError }, { count, error: countError }] = await Promise.all([
    supabase
      .from('cardforge_founder_beta_campaigns')
      .select('enabled,public_slot_cap,release_slot_cap,access_days,auto_grant,waitlist_enabled,campaign_title,landing_message,account_badge_label,export_gate_message,stripe_coupon_id,stripe_promotion_code,updated_at')
      .eq('id', 'founder_beta')
      .limit(1),
    supabase
      .from('cardforge_founder_beta_claims')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', 'founder_beta')
      .eq('status', 'active'),
  ]);

  if (campaignError || countError) {
    if (!isMissingOwnerTableError(campaignError) && !isMissingOwnerTableError(countError)) {
      console.error('Failed to load Founder Beta campaign:', campaignError ?? countError);
    }
    return {
      configured: false,
      campaign: DEFAULT_FOUNDER_BETA_CAMPAIGN,
    };
  }

  return {
    configured: true,
    campaign: mapFounderBetaCampaignRow(campaignRows?.[0] as FounderBetaCampaignRow | undefined, count ?? 0),
  };
};

const mapFounderBetaClaimRow = (row: FounderBetaClaimRow): FounderBetaClaim => ({
  id: row.id,
  email: row.email,
  status: row.status,
  claimedAt: row.claimed_at,
  accessExpiresAt: row.access_expires_at,
});

const mapOwnerRoadmapItemRow = (row: OwnerRoadmapItemRow): OwnerRoadmapItem => ({
  id: row.id,
  title: row.title,
  description: row.description,
  itemType: row.item_type ?? 'feature',
  status: row.status,
  source: row.source,
  visibleMonth: row.visible_month ?? '',
  targetMrrCents: row.target_mrr_cents,
  monthlyCostCents: row.monthly_cost_cents,
  shippedAt: row.shipped_at,
});

const mapDatabaseMetricsRow = (row: DatabaseMetricsRow): OwnerDatabaseMetrics => ({
  databaseSizeBytes: Number(row.database_size_bytes ?? 0),
  cardforgeTableSizeBytes: Number(row.cardforge_table_size_bytes ?? 0),
  storageSizeBytes: Number(row.storage_size_bytes ?? 0),
  assetRegistryCount: Number(row.asset_registry_count ?? 0),
  developerSubmissionCount: Number(row.developer_submission_count ?? 0),
  founderBetaClaimCount: Number(row.founder_beta_claim_count ?? 0),
});

const getOwnerDatabaseMetrics = async (): Promise<OwnerDatabaseMetrics | null> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return null;

  const { data, error } = await supabase.rpc('cardforge_database_metrics');
  if (error) {
    if ((error as { code?: string }).code !== 'PGRST202') {
      console.error('Failed to load owner database metrics:', error);
    }
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapDatabaseMetricsRow(row as DatabaseMetricsRow) : null;
};

const getFounderBetaClaims = async (): Promise<FounderBetaClaim[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return [];

  const { data, error } = await supabase
    .from('cardforge_founder_beta_claims')
    .select('id,email,status,claimed_at,access_expires_at')
    .eq('campaign_id', 'founder_beta')
    .order('claimed_at', { ascending: false })
    .limit(100);

  if (error) {
    if (!isMissingOwnerTableError(error)) {
      console.error('Failed to load Founder Beta claims:', error);
    }
    return [];
  }

  return (data ?? []).map((row) => mapFounderBetaClaimRow(row as FounderBetaClaimRow));
};

const getOwnerRoadmapItems = async (): Promise<OwnerRoadmapItem[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return [];

  const { data, error } = await supabase
    .from('cardforge_roadmap_items')
    .select('id,title,description,item_type,status,source,visible_month,target_mrr_cents,monthly_cost_cents,shipped_at')
    .eq('source', 'official')
    .order('visible_month', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    if (!isMissingOwnerTableError(error)) {
      console.error('Failed to load owner roadmap items:', error);
    }
    return [];
  }

  return (data ?? []).map((row) => mapOwnerRoadmapItemRow(row as OwnerRoadmapItemRow));
};

export const getOwnerConsolePayload = async (): Promise<OwnerConsolePayload> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return {
      configured: false,
      settings: DEFAULT_OWNER_SETTINGS,
      siteMechanics: DEFAULT_SITE_MECHANICS_SETTINGS,
      legalDocuments: DEFAULT_LEGAL_DOCUMENTS,
      founderBetaCampaign: DEFAULT_FOUNDER_BETA_CAMPAIGN,
      founderBetaClaims: [],
      roadmapItems: [],
      databaseMetrics: null,
    };
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from('cardforge_owner_settings')
    .select('business_name,owner_name,support_email,support_phone,website_url,max_active_user_roadmap_items,max_roadmap_suggestion_length,roadmap_negative_signal_min_total_votes,roadmap_negative_signal_min_downvote_percent')
    .eq('id', 'cardforge')
    .limit(1);

  if (settingsError) {
    if (!isMissingOwnerTableError(settingsError)) {
      console.error('Failed to load owner settings:', settingsError);
    }
    return {
      configured: false,
      settings: DEFAULT_OWNER_SETTINGS,
      siteMechanics: DEFAULT_SITE_MECHANICS_SETTINGS,
      legalDocuments: DEFAULT_LEGAL_DOCUMENTS,
      founderBetaCampaign: (await getFounderBetaCampaign()).campaign,
      founderBetaClaims: await getFounderBetaClaims(),
      roadmapItems: await getOwnerRoadmapItems(),
      databaseMetrics: await getOwnerDatabaseMetrics(),
    };
  }

  const { data: legalRows, error: legalError } = await supabase
    .from('cardforge_legal_documents')
    .select('slug,title,body,published_at')
    .order('slug', { ascending: true });

  if (legalError) {
    if (!isMissingOwnerTableError(legalError)) {
      console.error('Failed to load legal documents:', legalError);
    }
    return {
      configured: false,
      settings: mapSettingsRow(settingsRows?.[0] as OwnerSettingsRow | undefined),
      siteMechanics: mapSiteMechanicsRow(settingsRows?.[0] as OwnerSettingsRow | undefined),
      legalDocuments: DEFAULT_LEGAL_DOCUMENTS,
      founderBetaCampaign: (await getFounderBetaCampaign()).campaign,
      founderBetaClaims: await getFounderBetaClaims(),
      roadmapItems: await getOwnerRoadmapItems(),
      databaseMetrics: await getOwnerDatabaseMetrics(),
    };
  }

  const [founderBeta, founderBetaClaims, roadmapItems, databaseMetrics] = await Promise.all([
    getFounderBetaCampaign(),
    getFounderBetaClaims(),
    getOwnerRoadmapItems(),
    getOwnerDatabaseMetrics(),
  ]);

  const documents = DEFAULT_LEGAL_DOCUMENTS.map((defaultDocument) => {
    const row = (legalRows ?? []).find((document) => document.slug === defaultDocument.slug) as LegalDocumentRow | undefined;
    return row ? mapLegalRow(row) : defaultDocument;
  });

  return {
    configured: founderBeta.configured,
    settings: mapSettingsRow(settingsRows?.[0] as OwnerSettingsRow | undefined),
    siteMechanics: mapSiteMechanicsRow(settingsRows?.[0] as OwnerSettingsRow | undefined),
    legalDocuments: documents,
    founderBetaCampaign: founderBeta.campaign,
    founderBetaClaims,
    roadmapItems,
    databaseMetrics,
  };
};

export const updateOwnerSettings = async (input: Partial<Record<keyof OwnerSettings, unknown>>): Promise<OwnerConsolePayload> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new OwnerConsoleStoreError('Owner database is not configured yet.', 503);

  const normalized = normalizeOwnerSettingsInput(input);
  const { error } = await supabase
    .from('cardforge_owner_settings')
    .upsert({
      id: 'cardforge',
      business_name: normalized.businessName,
      owner_name: normalized.ownerName,
      support_email: normalized.supportEmail,
      support_phone: normalized.supportPhone,
      website_url: normalized.websiteUrl,
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.error('Failed to update owner settings:', error);
    throw new OwnerConsoleStoreError('Unable to update owner settings.', 500);
  }

  return getOwnerConsolePayload();
};

export const updateSiteMechanicsSettings = async (
  input: Partial<Record<keyof SiteMechanicsSettings, unknown>>
): Promise<OwnerConsolePayload> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new OwnerConsoleStoreError('Owner database is not configured yet.', 503);

  const normalized = normalizeSiteMechanicsSettingsInput(input);
  const { error } = await supabase
    .from('cardforge_owner_settings')
    .upsert({
      id: 'cardforge',
      max_active_user_roadmap_items: normalized.maxActiveUserRoadmapItems,
      max_roadmap_suggestion_length: normalized.maxRoadmapSuggestionLength,
      roadmap_negative_signal_min_total_votes: normalized.roadmapNegativeSignalMinTotalVotes,
      roadmap_negative_signal_min_downvote_percent: normalized.roadmapNegativeSignalMinDownvotePercent,
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.error('Failed to update site mechanics:', error);
    throw new OwnerConsoleStoreError('Unable to update site mechanics.', 500);
  }

  return getOwnerConsolePayload();
};

export const updateLegalDocument = async (input: { slug?: unknown; title?: unknown; body?: unknown }): Promise<OwnerConsolePayload> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new OwnerConsoleStoreError('Owner database is not configured yet.', 503);

  const normalized = normalizeLegalDocumentInput(input);
  if (!normalized.ok) throw new OwnerConsoleStoreError(normalized.message, 400);

  const { error } = await supabase
    .from('cardforge_legal_documents')
    .upsert({
      slug: normalized.value.slug,
      title: normalized.value.title,
      body: normalized.value.body,
      published_at: new Date().toISOString(),
    }, {
      onConflict: 'slug',
    });

  if (error) {
    console.error('Failed to update legal document:', error);
    throw new OwnerConsoleStoreError('Unable to update legal document.', 500);
  }

  return getOwnerConsolePayload();
};

export const updateFounderBetaCampaign = async (
  input: Partial<Record<keyof FounderBetaCampaign, unknown>>
): Promise<OwnerConsolePayload> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new OwnerConsoleStoreError('Owner database is not configured yet.', 503);

  const normalized = normalizeFounderBetaCampaignInput(input);
  const { error } = await supabase
    .from('cardforge_founder_beta_campaigns')
    .upsert({
      id: 'founder_beta',
      enabled: normalized.enabled,
      public_slot_cap: normalized.publicSlotCap,
      release_slot_cap: normalized.releaseSlotCap,
      access_days: normalized.accessDays,
      auto_grant: normalized.autoGrant,
      waitlist_enabled: normalized.waitlistEnabled,
      campaign_title: normalized.campaignTitle,
      landing_message: normalized.landingMessage,
      account_badge_label: normalized.accountBadgeLabel,
      export_gate_message: normalized.exportGateMessage,
      stripe_coupon_id: normalized.stripeCouponId,
      stripe_promotion_code: normalized.stripePromotionCode,
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.error('Failed to update Founder Beta campaign:', error);
    throw new OwnerConsoleStoreError('Unable to update Founder Beta campaign.', 500);
  }

  return getOwnerConsolePayload();
};

export const updateOwnerRoadmapItemStatus = async ({
  itemId,
  status,
}: {
  itemId?: unknown;
  status?: unknown;
}): Promise<OwnerConsolePayload> => {
  if (typeof itemId !== 'string' || itemId.trim().length === 0) {
    throw new OwnerConsoleStoreError('Roadmap item is required.', 400);
  }

  const normalizedStatus = normalizeOwnerRoadmapStatusInput(status);
  if (!normalizedStatus) {
    throw new OwnerConsoleStoreError('Choose a supported roadmap status.', 400);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) throw new OwnerConsoleStoreError('Roadmap database is not configured yet.', 503);

  const { error } = await supabase
    .from('cardforge_roadmap_items')
    .update({
      status: normalizedStatus,
      shipped_at: normalizedStatus === 'shipped' ? new Date().toISOString() : null,
    })
    .eq('id', itemId)
    .eq('source', 'official');

  if (error) {
    console.error('Failed to update roadmap status:', error);
    throw new OwnerConsoleStoreError('Unable to update roadmap status.', 500);
  }

  return getOwnerConsolePayload();
};

export const claimFounderBetaAccess = async ({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}): Promise<FounderBetaClaimResultRow & { campaign: FounderBetaCampaign }> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new OwnerConsoleStoreError('Founder Beta database is not configured yet.', 503);

  const { data, error } = await supabase.rpc('cardforge_claim_founder_beta', {
    p_clerk_user_id: userId,
    p_email: email,
  });

  if (error) {
    console.error('Failed to claim Founder Beta:', error);
    throw new OwnerConsoleStoreError('Unable to claim Founder Beta access.', 500);
  }

  const result = (Array.isArray(data) ? data[0] : data) as FounderBetaClaimResultRow | undefined;
  if (!result) throw new OwnerConsoleStoreError('Founder Beta claim returned no result.', 500);

  const { campaign } = await getFounderBetaCampaign();
  return { ...result, campaign };
};

export const getPublishedLegalDocument = async (slug: LegalDocumentSlug): Promise<{ settings: OwnerSettings; document: LegalDocument }> => {
  const payload = await getOwnerConsolePayload();
  return {
    settings: payload.settings,
    document: payload.legalDocuments.find((document) => document.slug === slug) ?? getDefaultLegalDocument(slug),
  };
};

export const getOwnerIntegrationStatus = () => ({
  authConfigured: isClerkAuthConfigured(),
  billing: getBillingConfigStatus(),
  supabase: getSupabaseServerConfigStatus(),
  ownerAllowlistConfigured: Boolean(process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS),
  links: [
    { label: 'Clerk Dashboard', href: 'https://dashboard.clerk.com/' },
    { label: 'Supabase Project', href: 'https://supabase.com/dashboard/project/mpmmhjjhdxjedbmuctiv' },
    { label: 'Stripe Dashboard', href: 'https://dashboard.stripe.com/' },
    { label: 'Vercel Dashboard', href: 'https://vercel.com/dashboard' },
    { label: 'OpenAI Platform', href: 'https://platform.openai.com/' },
  ],
});
