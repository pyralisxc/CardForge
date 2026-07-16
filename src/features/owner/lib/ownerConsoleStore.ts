import { isClerkAuthConfigured } from '@/features/account/server';
import { getBillingConfigStatus } from '@/features/billing/server';
import { getContactRequests } from '@/features/contact/server';
import { getLegalDocuments } from '@/features/legal/server';
import {
  DEFAULT_FOUNDER_BETA_CAMPAIGN,
  normalizeFounderBetaCampaignInput,
  reconcileFounderBetaCampaignCopy,
  type FounderBetaCampaign,
  type FounderBetaClaim,
  type OwnerConsolePayload,
  type OwnerDatabaseMetrics,
} from '@/features/owner/lib/ownerConsole';
import {
  getSiteContentBlocks,
  getSiteOperatorSettings,
} from '@/features/public-site/server';
import {
  getRoadmapAdminItems,
  getRoadmapSettings,
} from '@/features/roadmap/server';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';
import {
  getConfiguredPublicAppUrl,
  getPublicAppUrl,
} from '@/infrastructure/http/publicUrl';

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

type DatabaseMetricsRow = {
  database_size_bytes: number | null;
  cardforge_table_size_bytes: number | null;
  storage_size_bytes: number | null;
  asset_registry_count: number | null;
  developer_submission_count: number | null;
  founder_beta_claim_count: number | null;
};

export class OwnerConsoleStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const mapFounderBetaCampaignRow = (
  row: FounderBetaCampaignRow | null | undefined,
  claimedSlots: number,
): FounderBetaCampaign => reconcileFounderBetaCampaignCopy(row ? {
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
} : {
  ...DEFAULT_FOUNDER_BETA_CAMPAIGN,
  claimedSlots,
});

const getFounderBetaCampaign = async (): Promise<{
  configured: boolean;
  campaign: FounderBetaCampaign;
}> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return { configured: false, campaign: DEFAULT_FOUNDER_BETA_CAMPAIGN };
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
    if (!isMissingSupabaseTableError(campaignError) && !isMissingSupabaseTableError(countError)) {
      console.error('Failed to load Founder Beta campaign:', campaignError ?? countError);
    }
    return { configured: false, campaign: DEFAULT_FOUNDER_BETA_CAMPAIGN };
  }

  return {
    configured: true,
    campaign: mapFounderBetaCampaignRow(
      campaignRows?.[0] as FounderBetaCampaignRow | undefined,
      count ?? 0,
    ),
  };
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
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load Founder Beta claims:', error);
    }
    return [];
  }

  return (data ?? []).map((row) => {
    const claim = row as FounderBetaClaimRow;
    return {
      id: claim.id,
      email: claim.email,
      status: claim.status,
      claimedAt: claim.claimed_at,
      accessExpiresAt: claim.access_expires_at,
    };
  });
};

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

  const row = (Array.isArray(data) ? data[0] : data) as DatabaseMetricsRow | undefined;
  return row ? {
    databaseSizeBytes: Number(row.database_size_bytes ?? 0),
    cardforgeTableSizeBytes: Number(row.cardforge_table_size_bytes ?? 0),
    storageSizeBytes: Number(row.storage_size_bytes ?? 0),
    assetRegistryCount: Number(row.asset_registry_count ?? 0),
    developerSubmissionCount: Number(row.developer_submission_count ?? 0),
    founderBetaClaimCount: Number(row.founder_beta_claim_count ?? 0),
  } : null;
};

export const getOwnerConsolePayload = async (): Promise<OwnerConsolePayload> => {
  const [
    settings,
    siteMechanics,
    siteContentBlocks,
    legalDocuments,
    founderBeta,
    founderBetaClaims,
    roadmapItems,
    databaseMetrics,
    contactRequests,
  ] = await Promise.all([
    getSiteOperatorSettings(),
    getRoadmapSettings(),
    getSiteContentBlocks(),
    getLegalDocuments(),
    getFounderBetaCampaign(),
    getFounderBetaClaims(),
    getRoadmapAdminItems(),
    getOwnerDatabaseMetrics(),
    getContactRequests(),
  ]);

  return {
    configured: founderBeta.configured,
    settings,
    siteMechanics,
    siteContentBlocks,
    legalDocuments,
    founderBetaCampaign: founderBeta.campaign,
    founderBetaClaims,
    roadmapItems,
    databaseMetrics,
    contactRequests,
  };
};

export const updateFounderBetaCampaign = async (
  input: Partial<Record<keyof FounderBetaCampaign, unknown>>,
): Promise<OwnerConsolePayload> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new OwnerConsoleStoreError('Founder Beta database is not configured yet.', 503);

  const normalized = normalizeFounderBetaCampaignInput(input);
  const { error } = await supabase.from('cardforge_founder_beta_campaigns').upsert({
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
  }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to update Founder Beta campaign:', error);
    throw new OwnerConsoleStoreError('Unable to update Founder Beta campaign.');
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
    throw new OwnerConsoleStoreError('Unable to claim Founder Beta access.');
  }

  const result = (Array.isArray(data) ? data[0] : data) as FounderBetaClaimResultRow | undefined;
  if (!result) throw new OwnerConsoleStoreError('Founder Beta claim returned no result.');

  const { campaign } = await getFounderBetaCampaign();
  return { ...result, campaign };
};

export const getOwnerIntegrationStatus = () => {
  const publicAppUrl = getPublicAppUrl();
  const configuredPublicAppUrl = getConfiguredPublicAppUrl();

  return {
    site: {
      publicAppUrl,
      configuredPublicAppUrl,
      usingLocalFallback: !configuredPublicAppUrl,
      sitemapUrl: `${publicAppUrl}/sitemap.xml`,
      robotsUrl: `${publicAppUrl}/robots.txt`,
    },
    authConfigured: isClerkAuthConfigured(),
    billing: getBillingConfigStatus(),
    supabase: getSupabaseServerConfigStatus(),
    ownerAllowlistConfigured: Boolean(process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS),
    email: {
      contactMode: process.env.RESEND_API_KEY ? 'ready_for_server_delivery' as const : 'mailto' as const,
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      fromConfigured: Boolean(process.env.CARDFORGE_EMAIL_FROM),
      replyToConfigured: Boolean(process.env.CARDFORGE_EMAIL_REPLY_TO),
      missing: [
        !process.env.RESEND_API_KEY ? 'RESEND_API_KEY' : null,
        !process.env.CARDFORGE_EMAIL_FROM ? 'CARDFORGE_EMAIL_FROM' : null,
        !process.env.CARDFORGE_EMAIL_REPLY_TO ? 'CARDFORGE_EMAIL_REPLY_TO' : null,
      ].filter((value): value is string => Boolean(value)),
    },
    links: [
      { label: 'Clerk Dashboard', href: 'https://dashboard.clerk.com/' },
      { label: 'Supabase Project', href: 'https://supabase.com/dashboard/project/mpmmhjjhdxjedbmuctiv' },
      { label: 'Stripe Dashboard', href: 'https://dashboard.stripe.com/' },
      { label: 'Resend Dashboard', href: 'https://resend.com/domains' },
      { label: 'Vercel Dashboard', href: 'https://vercel.com/dashboard' },
      { label: 'OpenAI Platform', href: 'https://platform.openai.com/' },
    ],
  };
};
