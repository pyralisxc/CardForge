import type {
  SocialCampaign,
  SocialCampaignStatus,
  SocialCampaignVariant,
} from '@/features/developer-cockpit/model';

export type CampaignQueueFilter =
  | 'needs_action'
  | 'review'
  | 'active'
  | 'published'
  | 'cancelled'
  | 'all';

type CampaignRoleContext = {
  currentUserId: string;
  isOwner: boolean;
};

type CampaignWorkflowSummary = Pick<SocialCampaign, 'contributorId' | 'status'>;

const ownerActionStatuses = new Set<SocialCampaignStatus>([
  'submitted',
  'approved',
  'provider_draft',
  'failed',
]);

const contributorActionStatuses = new Set<SocialCampaignStatus>([
  'draft',
  'changes_requested',
]);

export const isCampaignActionable = (
  campaign: CampaignWorkflowSummary,
  context: CampaignRoleContext,
): boolean => context.isOwner
  ? ownerActionStatuses.has(campaign.status)
  : campaign.contributorId === context.currentUserId
    && contributorActionStatuses.has(campaign.status);

export const matchesCampaignQueueFilter = (
  campaign: CampaignWorkflowSummary,
  filter: CampaignQueueFilter,
  context: CampaignRoleContext,
): boolean => {
  if (filter === 'all') return true;
  if (filter === 'needs_action') return isCampaignActionable(campaign, context);
  if (filter === 'review') return campaign.status === 'submitted';
  if (filter === 'active') {
    return campaign.status !== 'published' && campaign.status !== 'cancelled';
  }
  return campaign.status === filter;
};

type CampaignReadinessInput = {
  title: string;
  objective: string;
  sourceReference: string;
  licenseNotes: string;
  variants: SocialCampaignVariant[];
};

export type CampaignReadinessItem = {
  key: 'brief' | 'source' | 'rights' | 'channels' | 'media';
  label: string;
  complete: boolean;
  requiredToSave: boolean;
};

export const getCampaignPackageReadiness = (
  campaign: CampaignReadinessInput,
): {
  items: CampaignReadinessItem[];
  completed: number;
  total: number;
  readyToSave: boolean;
} => {
  const hasMedia = campaign.variants.some((variant) => variant.media.length > 0);
  const items: CampaignReadinessItem[] = [
    {
      key: 'brief',
      label: 'Campaign brief',
      complete: Boolean(campaign.title.trim() && campaign.objective.trim()),
      requiredToSave: true,
    },
    {
      key: 'source',
      label: 'Source or release',
      complete: Boolean(campaign.sourceReference.trim()),
      requiredToSave: false,
    },
    {
      key: 'rights',
      label: 'Rights context',
      complete: Boolean(campaign.licenseNotes.trim()),
      requiredToSave: false,
    },
    {
      key: 'channels',
      label: 'Channel copy',
      complete: campaign.variants.length > 0
        && campaign.variants.every((variant) => Boolean(variant.text.trim())),
      requiredToSave: true,
    },
    {
      key: 'media',
      label: 'Accessible media',
      complete: hasMedia && campaign.variants.every((variant) => (
        variant.media.every((media) => Boolean(media.alt.trim()))
      )),
      requiredToSave: false,
    },
  ];

  return {
    items,
    completed: items.filter((item) => item.complete).length,
    total: items.length,
    readyToSave: items
      .filter((item) => item.requiredToSave)
      .every((item) => item.complete),
  };
};

export const getCampaignStatusGuidance = (
  status: SocialCampaignStatus,
  isOwner: boolean,
): string => {
  if (status === 'draft') return 'Complete the production package, then submit it for owner review.';
  if (status === 'submitted') {
    return isOwner
      ? 'Review the proof, destination, rights, and channel deliverables before deciding.'
      : 'The package is waiting for owner review.';
  }
  if (status === 'changes_requested') {
    return isOwner
      ? 'The contributor has revisions to address.'
      : 'Open the package, address the owner note, and submit it again.';
  }
  if (status === 'approved') {
    return isOwner
      ? 'The package and media are approved. Provider setup is the next owner action.'
      : 'The package is approved; publishing remains owner-controlled.';
  }
  if (status === 'provider_draft') return 'Provider drafts exist and remain under owner control.';
  if (status === 'scheduled') return 'The approved package is scheduled with the publishing provider.';
  if (status === 'published') return 'This package and its delivery record are retained as campaign history.';
  if (status === 'failed') return 'Provider delivery needs owner attention; the approved package is preserved.';
  return 'This package is closed and retained in campaign history.';
};
