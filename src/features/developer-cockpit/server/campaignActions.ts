import type { SocialCampaign } from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';

export const getAllowedCampaignActions = (
  campaign: SocialCampaign,
  access: DeveloperCockpitAccess,
): string[] => {
  if (access.isOwner && campaign.status === 'submitted') {
    return ['request_changes', 'approve'];
  }
  if (
    !access.isOwner
    && campaign.contributorId === access.user.id
    && ['draft', 'changes_requested'].includes(campaign.status)
  ) {
    return ['save', 'submit', 'cancel'];
  }
  if (access.isOwner && campaign.status === 'approved') {
    return ['create_provider_draft'];
  }
  return [];
};
