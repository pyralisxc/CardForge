import type {
  CampaignMedia,
  SocialCampaign,
  SocialPublishJob,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

import {
  ASSOCIATION_COLUMNS,
  ATTACHMENT_COLUMNS,
  CAMPAIGN_COLUMNS,
  DERIVATIVE_COLUMNS,
  JOB_COLUMNS,
  MEDIA_COLUMNS,
  mapCampaignRow,
  mapJobRow,
  mapMediaRow,
  readDatabaseRows,
  readFirstDatabaseRow,
  type AssociationRow,
  type AttachmentRow,
  type CampaignMediaRow,
  type CampaignRow,
  type DerivativeRow,
  type PublishJobRow,
} from './storeRows';

export * from './storeRows';

export class DeveloperCockpitStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

export const requireCockpitDatabase = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new DeveloperCockpitStoreError(
      'The contribution cockpit database is not configured yet.',
      503,
    );
  }
  return supabase;
};

export const cleanReviewNote = (value: unknown): string => (
  typeof value === 'string'
    ? value.trim().replace(/\r\n/g, '\n').slice(0, 1200)
    : ''
);

export const normalizeExpectedVersion = (value: unknown): number => {
  const version = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new DeveloperCockpitStoreError(
      'A valid contribution version is required.',
      400,
    );
  }
  return version;
};

export const throwCockpitDatabaseError = (
  message: string,
  error: unknown,
): never => {
  console.error(message, error);
  throw new DeveloperCockpitStoreError(message);
};

export const getCampaignMediaRows = async (
  mediaIds: string[],
): Promise<{
  media: CampaignMedia[];
  rows: CampaignMediaRow[];
  derivatives: DerivativeRow[];
}> => {
  if (!mediaIds.length) return { media: [], rows: [], derivatives: [] };
  const supabase = requireCockpitDatabase();
  const [mediaResult, derivativeResult] = await Promise.all([
    supabase.from('cardforge_campaign_media').select(MEDIA_COLUMNS).in('id', mediaIds),
    supabase
      .from('cardforge_campaign_media_derivatives')
      .select(DERIVATIVE_COLUMNS)
      .in('parent_media_id', mediaIds),
  ]);
  if (mediaResult.error || derivativeResult.error) {
    throwCockpitDatabaseError(
      'Unable to load campaign media.',
      mediaResult.error ?? derivativeResult.error,
    );
  }

  const rows = readDatabaseRows<CampaignMediaRow>(mediaResult.data);
  const derivatives = readDatabaseRows<DerivativeRow>(derivativeResult.data);
  return {
    rows,
    derivatives,
    media: rows.map((row) => mapMediaRow(
      row,
      derivatives.filter((derivative) => derivative.parent_media_id === row.id),
    )),
  };
};

export const getVisibleCampaignDerivatives = (
  media: CampaignMediaRow,
  derivatives: DerivativeRow[],
  access?: DeveloperCockpitAccess,
) => !access || access.isOwner || media.ingesting_contributor_id === access.user.id
  ? derivatives
  : derivatives.filter((derivative) => derivative.exposure === 'public');

export const hydrateCampaignRows = async (
  campaignRows: CampaignRow[],
  access?: DeveloperCockpitAccess,
): Promise<SocialCampaign[]> => {
  if (!campaignRows.length) return [];
  const supabase = requireCockpitDatabase();
  const campaignIds = campaignRows.map((campaign) => campaign.id);
  const [attachmentResult, associationResult] = await Promise.all([
    supabase
      .from('cardforge_social_campaign_media_attachments')
      .select(ATTACHMENT_COLUMNS)
      .in('campaign_id', campaignIds),
    supabase
      .from('cardforge_social_campaign_associations')
      .select(ASSOCIATION_COLUMNS)
      .in('campaign_id', campaignIds),
  ]);
  if (attachmentResult.error || associationResult.error) {
    throwCockpitDatabaseError(
      'Unable to load campaign relationships.',
      attachmentResult.error ?? associationResult.error,
    );
  }

  const attachments = readDatabaseRows<AttachmentRow>(attachmentResult.data);
  const associations = readDatabaseRows<AssociationRow>(associationResult.data);
  const mediaIds = [...new Set(attachments.map((attachment) => attachment.media_id))];
  const { rows: mediaRows, derivatives } = await getCampaignMediaRows(mediaIds);
  const media = mediaRows.map((row) => mapMediaRow(
    row,
    getVisibleCampaignDerivatives(
      row,
      derivatives.filter((derivative) => derivative.parent_media_id === row.id),
      access,
    ),
  ));
  const mediaById = new Map(media.map((item) => [item.id, item]));

  return campaignRows.map((row) => mapCampaignRow(
    row,
    attachments.filter((attachment) => attachment.campaign_id === row.id),
    mediaById,
    associations.filter((association) => association.campaign_id === row.id),
  ));
};

export const getCampaignRecord = async (
  campaignId: string,
  access?: DeveloperCockpitAccess,
): Promise<SocialCampaign> => {
  const { data, error } = await requireCockpitDatabase()
    .from('cardforge_social_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('id', campaignId)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to load the campaign package.', error);
  const row = readFirstDatabaseRow<CampaignRow>(data);
  if (!row) {
    throw new DeveloperCockpitStoreError('Campaign package not found.', 404);
  }
  return (await hydrateCampaignRows([row], access))[0]!;
};

export const fetchPublishJobs = async (
  campaignIds: string[],
): Promise<SocialPublishJob[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || !campaignIds.length) return [];
  const { data, error } = await supabase
    .from('cardforge_social_publish_jobs')
    .select(JOB_COLUMNS)
    .in('campaign_id', campaignIds)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Failed to load social publish jobs:', error);
    return [];
  }
  return readDatabaseRows<PublishJobRow>(data).map(mapJobRow);
};
