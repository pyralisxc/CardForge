import type { ContributorAccess } from '@/features/contributor-access/server';
import type {
  CampaignDeskProjection,
  MarketingContentPackage,
  MarketingContentWorkspaceView,
} from '@/features/marketing-content/model';
import {
  fetchPublishJobs,
} from '@/features/marketing-content/server/storeShared';
import {
  getAuthorizedCampaignMediaPage,
  getCampaignMediaLibrarySummary,
} from '@/features/marketing-content/server/media';
import { listSocialCampaigns } from '@/features/marketing-content/server/campaignStore';

const fetchCampaigns = async (
  access: ContributorAccess,
): Promise<MarketingContentPackage[]> => (
  await listSocialCampaigns({
    access,
    cursor: 0,
    limit: access.isOwner ? 200 : 100,
  })
).campaigns;

export const getCampaignDeskProjection = async (
  access: ContributorAccess,
): Promise<CampaignDeskProjection> => ({ campaigns: await fetchCampaigns(access) });

export const getMarketingContentWorkspace = async (
  access: ContributorAccess,
  marketing: Pick<MarketingContentWorkspaceView, 'marketingStrategy' | 'marketingCampaigns'>,
): Promise<MarketingContentWorkspaceView> => {
  const [campaigns, campaignMediaPage, campaignMediaSummary] = await Promise.all([
    fetchCampaigns(access),
    getAuthorizedCampaignMediaPage(access, { page: 1, pageSize: 24 }),
    getCampaignMediaLibrarySummary(access),
  ]);
  const publishJobs = await fetchPublishJobs(campaigns.map((campaign) => campaign.id));

  return {
    currentUserId: access.user.id,
    isOwner: access.isOwner,
    scopes: access.scopes,
    campaigns,
    campaignMedia: campaignMediaPage.items,
    campaignMediaSummary,
    campaignMediaPage: {
      total: campaignMediaPage.total,
      page: campaignMediaPage.page,
      pageSize: campaignMediaPage.pageSize,
    },
    publishJobs,
    marketingStrategy: marketing.marketingStrategy,
    marketingCampaigns: marketing.marketingCampaigns,
  };
};
