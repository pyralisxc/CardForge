import { getSiteContentBlocks } from '@/features/public-site/server';
import type {
  DeveloperCockpitView,
  SiteContentProposal,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import { listDeveloperAccessProfiles } from '@/features/developer-access/server';
import { getMarketingContributorContext } from '@/features/marketing/server';
import type { MarketingContentPackage as SocialCampaign } from '@/features/marketing-content/client';
import {
  fetchPublishJobs,
  getAuthorizedCampaignMediaPage,
  getCampaignMediaLibrarySummary,
  listSocialCampaigns,
} from '@/features/marketing-content/server';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';
import {
  mapProposalRow,
  PROPOSAL_COLUMNS,
  readDatabaseRows,
  type SiteProposalRow,
} from './siteProposalRows';

const fetchCampaigns = async (
  access: DeveloperCockpitAccess,
): Promise<{ configured: boolean; campaigns: SocialCampaign[] }> => {
  try {
    const result = await listSocialCampaigns({
      access,
      cursor: 0,
      limit: access.isOwner ? 200 : 100,
    });
    return { configured: true, campaigns: result.campaigns };
  } catch (error) {
    console.error('Failed to load marketing content packages:', error);
    return { configured: false, campaigns: [] };
  }
};

const fetchSiteProposals = async (
  access: DeveloperCockpitAccess,
): Promise<{ configured: boolean; proposals: SiteContentProposal[] }> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { configured: false, proposals: [] };
  let query = supabase
    .from('cardforge_site_content_proposals')
    .select(PROPOSAL_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(access.isOwner ? 200 : 100);
  if (!access.isOwner) query = query.eq('contributor_id', access.user.id);
  const { data, error } = await query;
  if (error) {
    if (!isMissingSupabaseTableError(error)) console.error('Failed to load site proposals:', error);
    return { configured: false, proposals: [] };
  }
  return {
    configured: true,
    proposals: readDatabaseRows<SiteProposalRow>(data).map(mapProposalRow),
  };
};

export const getDeveloperCockpitView = async (
  access: DeveloperCockpitAccess,
): Promise<DeveloperCockpitView> => {
  const [campaignResult, proposalResult, siteContentBlocks, profiles, campaignMediaPage, campaignMediaSummary, marketing] = await Promise.all([
    fetchCampaigns(access),
    fetchSiteProposals(access),
    getSiteContentBlocks(),
    listDeveloperAccessProfiles(access.isOwner),
    getAuthorizedCampaignMediaPage(access, { page: 1, pageSize: 24 }),
    getCampaignMediaLibrarySummary(access),
    getMarketingContributorContext(),
  ]);
  const publishJobs = await fetchPublishJobs(campaignResult.campaigns.map((campaign) => campaign.id));
  return {
    configured: getSupabaseServerConfigStatus().configured
      && campaignResult.configured
      && proposalResult.configured,
    extendedContributionsEnabled:
      process.env.CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED === 'true',
    currentUserId: access.user.id,
    isDeveloper: access.isDeveloper,
    isOwner: access.isOwner,
    scopes: access.scopes,
    campaigns: campaignResult.campaigns,
    campaignMedia: campaignMediaPage.items,
    campaignMediaSummary,
    campaignMediaPage: {
      total: campaignMediaPage.total,
      page: campaignMediaPage.page,
      pageSize: campaignMediaPage.pageSize,
    },
    publishJobs,
    siteProposals: proposalResult.proposals,
    siteContentBlocks,
    profiles,
    marketingStrategy: marketing.strategy,
    marketingCampaigns: marketing.campaigns,
  };
};
