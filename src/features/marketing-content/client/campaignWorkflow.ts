import type {
  MarketingContentPackage as SocialCampaign,
  MarketingContentStatus as SocialCampaignStatus,
  MarketingChannelVariant as SocialCampaignVariant,
  MarketingDeliveryStatus as SocialPublishJobStatus,
} from '@/features/marketing-content/model';

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

const workflowStatusLabels: Record<SocialCampaignStatus | SocialPublishJobStatus, string> = {
  draft: 'Draft',
  submitted: 'Awaiting review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  planned: 'Planned',
  ready: 'Ready to publish',
  provider_draft: 'Provider draft',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Delivery failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
  unknown: 'Status unavailable',
};

export const getCampaignStatusLabel = (status: SocialCampaignStatus): string =>
  workflowStatusLabels[status];

export const getPublishJobStatusLabel = (status: SocialPublishJobStatus): string =>
  workflowStatusLabels[status];

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
  productionNote: string;
  variants: SocialCampaignVariant[];
};

export type CampaignMediaExpectation = {
  level: 'required' | 'recommended' | 'optional';
  label: string;
  guidance: string;
};

export const getCampaignMediaExpectation = (
  campaign: Pick<SocialCampaign, 'contentKind' | 'contentPillar' | 'variants'>,
): CampaignMediaExpectation => {
  if (campaign.variants.some((variant) => variant.service === 'instagram')) {
    return {
      level: 'required',
      label: 'Media required',
      guidance: 'Instagram requires an approved image before this package can be submitted.',
    };
  }
  if (campaign.contentKind === 'demonstration') {
    return {
      level: 'recommended',
      label: 'Media recommended',
      guidance: 'A product demonstration should show the workflow, card set, or finished result it describes.',
    };
  }
  if (campaign.contentPillar === 'product-proof' || campaign.contentKind === 'creator-story') {
    return {
      level: 'recommended',
      label: 'Media recommended',
      guidance: 'This story will be stronger with real CardForge work or a rights-cleared creator image.',
    };
  }
  return {
    level: 'optional',
    label: 'Text-first is valid',
    guidance: 'This post can remain text-only; add media only when it adds useful evidence or context.',
  };
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
  const hasMedia = campaign.variants.some((variant) => variant.attachments.length > 0);
  const items: CampaignReadinessItem[] = [
    {
      key: 'brief',
      label: 'Campaign brief',
      complete: Boolean(campaign.title.trim() && campaign.objective.trim()),
      requiredToSave: true,
    },
    {
      key: 'source',
      label: 'Release context',
      complete: Boolean(campaign.productionNote.trim()),
      requiredToSave: false,
    },
    {
      key: 'rights',
      label: 'Rights-aware media',
      complete: hasMedia && campaign.variants.flatMap((variant) => variant.attachments).every((attachment) => Boolean(attachment.media.rightsBasis.trim())),
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
        variant.attachments.every((attachment) => Boolean(attachment.altText.trim()))
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
  if (status === 'draft') return 'Complete the campaign package, then submit it for owner review.';
  if (status === 'submitted') {
    return isOwner
      ? 'Review the proof, destination, rights, and social posts before deciding.'
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
  if (status === 'scheduled') return 'The approved content is scheduled for delivery from Marketing.';
  if (status === 'published') return 'This package and its delivery record are retained as campaign history.';
  if (status === 'failed') return 'Provider delivery needs owner attention; the approved package is preserved.';
  return 'This package is closed and retained in campaign history.';
};
