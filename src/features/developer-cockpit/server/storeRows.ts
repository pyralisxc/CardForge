import type {
  CampaignDevelopmentAssociation,
  CampaignMedia,
  CampaignMediaAttachment,
  CampaignMediaDerivative,
  SiteContentProposal,
  SocialCampaign,
  SocialCampaignStatus,
  SocialPublishJob,
  SocialPublishJobStatus,
  SocialService,
} from '@/features/developer-cockpit/model';

export type CampaignRow = {
  id: string;
  contributor_id: string;
  contributor_email: string | null;
  contributor_name: string | null;
  title: string;
  objective: string;
  destination_url: string;
  production_note: string;
  variants: unknown;
  status: SocialCampaignStatus;
  requested_publish_at: string | null;
  review_note: string;
  reviewed_by: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type CampaignMediaRow = {
  id: string;
  ingesting_contributor_id: string;
  contributor_email: string | null;
  contributor_name: string | null;
  media_kind: 'image';
  original_mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  original_filename: string;
  original_byte_count: number;
  width: number;
  height: number;
  content_hash: string;
  perceptual_hash: string | null;
  original_storage_bucket: string;
  original_storage_path: string;
  normalized_storage_bucket: string;
  normalized_storage_path: string;
  normalized_byte_count: number;
  normalized_mime_type: 'image/webp';
  rights_basis: string;
  creator_credit: string;
  rights_restriction: string;
  rights_expires_at: string | null;
  reusable_caption: string;
  reusable_description: string;
  focal_x: number | null;
  focal_y: number | null;
  review_state: CampaignMedia['reviewState'];
  archived_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DerivativeRow = {
  id: string;
  parent_media_id: string;
  purpose: CampaignMediaDerivative['purpose'];
  width: number;
  height: number;
  mime_type: 'image/webp';
  byte_count: number;
  storage_bucket: string;
  storage_path: string;
  crop_x: number | null;
  crop_y: number | null;
  crop_width: number | null;
  crop_height: number | null;
  exposure: 'private' | 'public';
  promotion_key: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

export type AttachmentRow = {
  id: string;
  campaign_id: string;
  service: SocialService;
  media_id: string;
  derivative_id: string | null;
  display_order: number;
  alt_text: string;
  caption_override: string;
  crop_intent: unknown;
  created_at: string;
};

export type AssociationRow = {
  id: string;
  campaign_id: string;
  kind: CampaignDevelopmentAssociation['kind'];
  external_key: string;
  reference_url: string;
  title_snapshot: string;
  metadata_snapshot: unknown;
  note: string;
  created_by: string;
  created_at: string;
};

export type PublishJobRow = {
  id: string;
  campaign_id: string;
  provider: 'buffer';
  service: SocialService;
  provider_channel_id: string;
  provider_post_id: string | null;
  status: SocialPublishJobStatus;
  scheduled_for: string | null;
  error_message: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteProposalRow = {
  id: string;
  contributor_id: string;
  contributor_email: string | null;
  contributor_name: string | null;
  slug: SiteContentProposal['slug'];
  base_body: string;
  proposed_body: string;
  rationale: string;
  status: SiteContentProposal['status'];
  review_note: string;
  reviewed_by: string | null;
  submitted_at: string | null;
  published_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export const CAMPAIGN_COLUMNS = [
  'id', 'contributor_id', 'contributor_email', 'contributor_name', 'title',
  'objective', 'destination_url', 'production_note', 'variants', 'status',
  'requested_publish_at', 'review_note', 'reviewed_by', 'submitted_at',
  'approved_at', 'version', 'created_at', 'updated_at',
].join(',');

export const MEDIA_COLUMNS = [
  'id', 'ingesting_contributor_id', 'contributor_email', 'contributor_name',
  'media_kind', 'original_mime_type', 'original_filename', 'original_byte_count',
  'width', 'height', 'content_hash', 'perceptual_hash', 'original_storage_bucket',
  'original_storage_path', 'normalized_storage_bucket', 'normalized_storage_path',
  'normalized_byte_count', 'normalized_mime_type', 'rights_basis', 'creator_credit',
  'rights_restriction', 'rights_expires_at', 'reusable_caption',
  'reusable_description', 'focal_x', 'focal_y', 'review_state', 'archived_at',
  'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
].join(',');

export const DERIVATIVE_COLUMNS = [
  'id', 'parent_media_id', 'purpose', 'width', 'height', 'mime_type',
  'byte_count', 'storage_bucket', 'storage_path', 'crop_x', 'crop_y',
  'crop_width', 'crop_height', 'exposure', 'promotion_key', 'approved_by',
  'approved_at', 'created_at',
].join(',');

export const ATTACHMENT_COLUMNS = [
  'id', 'campaign_id', 'service', 'media_id', 'derivative_id', 'display_order',
  'alt_text', 'caption_override', 'crop_intent', 'created_at',
].join(',');

export const ASSOCIATION_COLUMNS = [
  'id', 'campaign_id', 'kind', 'external_key', 'reference_url',
  'title_snapshot', 'metadata_snapshot', 'note', 'created_by', 'created_at',
].join(',');

export const JOB_COLUMNS = [
  'id', 'campaign_id', 'provider', 'service', 'provider_channel_id',
  'provider_post_id', 'status', 'scheduled_for', 'error_message',
  'last_checked_at', 'created_at', 'updated_at',
].join(',');

export const PROPOSAL_COLUMNS = [
  'id', 'contributor_id', 'contributor_email', 'contributor_name', 'slug',
  'base_body', 'proposed_body', 'rationale', 'status', 'review_note',
  'reviewed_by', 'submitted_at', 'published_at', 'version', 'created_at',
  'updated_at',
].join(',');

const record = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

export const readDatabaseRows = <Row>(value: unknown): Row[] => (
  Array.isArray(value) ? value as Row[] : []
);

export const readFirstDatabaseRow = <Row>(value: unknown): Row | undefined => (
  readDatabaseRows<Row>(value)[0]
);

const previewUrl = (mediaId: string, derivativeId?: string) => (
  `/api/developer-cockpit/media/${mediaId}${
    derivativeId ? `?derivativeId=${encodeURIComponent(derivativeId)}` : ''
  }`
);

export const mapDerivativeRow = (
  row: DerivativeRow,
): CampaignMediaDerivative => ({
  id: row.id,
  purpose: row.purpose,
  width: row.width,
  height: row.height,
  mimeType: row.mime_type,
  byteCount: row.byte_count,
  exposure: row.exposure,
  crop: row.crop_x === null
    ? null
    : {
      x: row.crop_x,
      y: row.crop_y!,
      width: row.crop_width!,
      height: row.crop_height!,
    },
  approvedAt: row.approved_at,
  createdAt: row.created_at,
  previewUrl: previewUrl(row.parent_media_id, row.id),
});

export const mapMediaRow = (
  row: CampaignMediaRow,
  derivatives: DerivativeRow[] = [],
  campaignIds: string[] = [],
  deliveryCount = 0,
): CampaignMedia => ({
  id: row.id,
  ingestingContributorId: row.ingesting_contributor_id,
  contributorEmail: row.contributor_email,
  contributorName: row.contributor_name,
  mediaKind: row.media_kind,
  originalMimeType: row.original_mime_type,
  originalFilename: row.original_filename,
  originalByteCount: row.original_byte_count,
  width: row.width,
  height: row.height,
  contentHash: row.content_hash,
  perceptualHash: row.perceptual_hash,
  normalizedByteCount: row.normalized_byte_count,
  rightsBasis: row.rights_basis,
  creatorCredit: row.creator_credit,
  rightsRestriction: row.rights_restriction,
  rightsExpiresAt: row.rights_expires_at,
  reusableCaption: row.reusable_caption,
  reusableDescription: row.reusable_description,
  focalPoint: row.focal_x === null
    ? null
    : { x: row.focal_x, y: row.focal_y! },
  reviewState: row.review_state,
  archivedAt: row.archived_at,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  previewUrl: previewUrl(row.id),
  derivatives: derivatives.map(mapDerivativeRow),
  campaignIds,
  deliveryCount,
});

export const mapAssociationRow = (
  row: AssociationRow,
): CampaignDevelopmentAssociation => ({
  id: row.id,
  kind: row.kind,
  externalKey: row.external_key,
  referenceUrl: row.reference_url,
  titleSnapshot: row.title_snapshot,
  metadataSnapshot: record(row.metadata_snapshot),
  note: row.note,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const mapAttachments = (
  service: SocialService,
  attachments: AttachmentRow[],
  mediaById: Map<string, CampaignMedia>,
): CampaignMediaAttachment[] => attachments
  .filter((attachment) => attachment.service === service)
  .sort((left, right) => left.display_order - right.display_order)
  .flatMap((attachment) => {
    const media = mediaById.get(attachment.media_id);
    return media
      ? [{
        id: attachment.id,
        mediaId: attachment.media_id,
        derivativeId: attachment.derivative_id,
        displayOrder: attachment.display_order,
        altText: attachment.alt_text,
        captionOverride: attachment.caption_override,
        cropIntent: record(attachment.crop_intent),
        media,
      }]
      : [];
  });

export const mapCampaignRow = (
  row: CampaignRow,
  attachments: AttachmentRow[] = [],
  mediaById = new Map<string, CampaignMedia>(),
  associations: AssociationRow[] = [],
): SocialCampaign => {
  const copies = Array.isArray(row.variants)
    ? row.variants as Array<{ service?: SocialService; text?: string }>
    : [];
  return {
    id: row.id,
    contributorId: row.contributor_id,
    contributorEmail: row.contributor_email,
    contributorName: row.contributor_name,
    title: row.title,
    objective: row.objective,
    destinationUrl: row.destination_url,
    productionNote: row.production_note,
    variants: copies.map((variant) => ({
      service: variant.service!,
      text: variant.text ?? '',
      attachments: mapAttachments(variant.service!, attachments, mediaById),
    })),
    associations: associations.map(mapAssociationRow),
    status: row.status,
    requestedPublishAt: row.requested_publish_at,
    reviewNote: row.review_note,
    reviewedBy: row.reviewed_by,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const mapJobRow = (row: PublishJobRow): SocialPublishJob => ({
  id: row.id,
  campaignId: row.campaign_id,
  provider: row.provider,
  service: row.service,
  providerChannelId: row.provider_channel_id,
  providerPostId: row.provider_post_id,
  status: row.status,
  scheduledFor: row.scheduled_for,
  errorMessage: row.error_message,
  lastCheckedAt: row.last_checked_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapProposalRow = (row: SiteProposalRow): SiteContentProposal => ({
  id: row.id,
  contributorId: row.contributor_id,
  contributorEmail: row.contributor_email,
  contributorName: row.contributor_name,
  slug: row.slug,
  baseBody: row.base_body,
  proposedBody: row.proposed_body,
  rationale: row.rationale,
  status: row.status,
  reviewNote: row.review_note,
  reviewedBy: row.reviewed_by,
  submittedAt: row.submitted_at,
  publishedAt: row.published_at,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
