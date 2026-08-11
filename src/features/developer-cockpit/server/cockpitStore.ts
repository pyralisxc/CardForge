import { getSiteContentBlocks } from '@/features/public-site/server';
import type {
  DeveloperCockpitView,
  SiteContentProposal,
  SocialCampaign,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import { listDeveloperAccessProfiles } from '@/features/developer-access/server';
import { getBufferConfiguration } from '@/features/social-publishing/server';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';
import {
  CAMPAIGN_COLUMNS,
  fetchPublishJobs,
  hydrateCampaignRows,
  mapProposalRow,
  PROPOSAL_COLUMNS,
  type CampaignRow,
  type SiteProposalRow,
} from './storeShared';
import { getAuthorizedCampaignMedia } from './media';

const fetchCampaigns = async (
  access: DeveloperCockpitAccess,
): Promise<{ configured: boolean; campaigns: SocialCampaign[] }> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { configured: false, campaigns: [] };
  let query = supabase
    .from('cardforge_social_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(access.isOwner ? 200 : 100);
  if (!access.isOwner) query = query.eq('contributor_id', access.user.id);
  const { data, error } = await query;
  if (error) {
    if (!isMissingSupabaseTableError(error)) console.error('Failed to load social campaigns:', error);
    return { configured: false, campaigns: [] };
  }
  return { configured: true, campaigns: await hydrateCampaignRows((data ?? []) as CampaignRow[]) };
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
    proposals: (data ?? []).map((row) => mapProposalRow(row as SiteProposalRow)),
  };
};

export const getDeveloperCockpitView = async (
  access: DeveloperCockpitAccess,
): Promise<DeveloperCockpitView> => {
  const [campaignResult, proposalResult, siteContentBlocks, profiles, campaignMedia] = await Promise.all([
    fetchCampaigns(access),
    fetchSiteProposals(access),
    getSiteContentBlocks(),
    listDeveloperAccessProfiles(access.isOwner),
    getAuthorizedCampaignMedia(access),
  ]);
  const publishJobs = await fetchPublishJobs(campaignResult.campaigns.map((campaign) => campaign.id));
  const provider = getBufferConfiguration();
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
    campaignMedia,
    campaignMediaSummary: {
      mediaCount: campaignMedia.length,
      protectedBytes: campaignMedia.reduce((total, media) => total + media.originalByteCount + media.normalizedByteCount, 0),
      derivativeBytes: campaignMedia.reduce((total, media) => total + media.derivatives.reduce((derivativeTotal, derivative) => derivativeTotal + derivative.byteCount, 0), 0),
      unusedMediaCount: campaignMedia.filter((media) => media.campaignIds.length === 0 && !media.archivedAt).length,
    },
    publishJobs,
    siteProposals: proposalResult.proposals,
    siteContentBlocks,
    profiles,
    provider: {
      name: 'buffer',
      configured: provider.configured,
      publishingEnabled: provider.publishingEnabled,
      organizationId: provider.organizationId,
      allowedChannelCount: provider.allowedChannelIds.length,
      missing: provider.missing,
    },
  };
};
