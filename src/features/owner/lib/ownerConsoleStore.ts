import {
  getFounderBetaCampaign,
  getFounderBetaClaims,
  isClerkAuthConfigured,
} from '@/features/account/server';
import { getBillingConfigStatus } from '@/features/billing/server';
import { getContactRequests } from '@/features/contact/server';
import { getLegalDocuments } from '@/features/legal/server';
import {
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
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';
import {
  getConfiguredPublicAppUrl,
  getPublicAppUrl,
} from '@/infrastructure/http/publicUrl';

type DatabaseMetricsRow = {
  database_size_bytes: number | null;
  cardforge_table_size_bytes: number | null;
  storage_size_bytes: number | null;
  asset_registry_count: number | null;
  developer_submission_count: number | null;
  founder_beta_claim_count: number | null;
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
