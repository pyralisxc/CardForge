import type { CampaignMedia } from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';

import {
  DERIVATIVE_COLUMNS,
  DeveloperCockpitStoreError,
  getCampaignMediaRows,
  MEDIA_COLUMNS,
  mapMediaRow,
  readDatabaseRows,
  readFirstDatabaseRow,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
  type CampaignMediaRow,
  type DerivativeRow,
} from './storeShared';

export const SOCIAL_SOURCE_BUCKET = 'cardforge-social-sources';
export const SOCIAL_PUBLIC_MEDIA_BUCKET = 'cardforge-social-media';
export const MAX_SOCIAL_MEDIA_BYTES = 12 * 1024 * 1024;
export const SOCIAL_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const validateSocialMediaFile = ({
  size,
  type,
}: {
  size: number;
  type: string;
}) => {
  if (size <= 0 || size > MAX_SOCIAL_MEDIA_BYTES) {
    return {
      ok: false as const,
      message: 'Choose a campaign image that is 12 MB or smaller.',
    };
  }
  if (!SOCIAL_MEDIA_MIME_TYPES.has(type)) {
    return {
      ok: false as const,
      message: 'Choose a JPEG, PNG, or WebP campaign image.',
    };
  }
  return { ok: true as const };
};

const isMediaVisible = (
  row: CampaignMediaRow,
  access: DeveloperCockpitAccess,
) => access.isOwner
  || row.ingesting_contributor_id === access.user.id
  || ['approved', 'public'].includes(row.review_state);

export const assertMediaAccess = (
  row: CampaignMediaRow,
  access: DeveloperCockpitAccess,
) => {
  if (!isMediaVisible(row, access)) {
    throw new DeveloperCockpitStoreError('Campaign media access denied.', 403);
  }
};

export const assertDerivativeAccess = (
  row: CampaignMediaRow,
  derivative: DerivativeRow,
  access: DeveloperCockpitAccess,
) => {
  assertMediaAccess(row, access);
  if (
    !access.isOwner
    && row.ingesting_contributor_id !== access.user.id
    && derivative.exposure !== 'public'
  ) {
    throw new DeveloperCockpitStoreError('Campaign media access denied.', 403);
  }
};

export const getCampaignMediaRecord = async (
  mediaId: string,
): Promise<{
  media: CampaignMedia;
  row: CampaignMediaRow;
  derivatives: DerivativeRow[];
}> => {
  const { rows, derivatives, media } = await getCampaignMediaRows([mediaId]);
  const row = rows[0];
  const value = media[0];
  if (!row || !value) {
    throw new DeveloperCockpitStoreError('Campaign media not found.', 404);
  }
  return { row, derivatives, media: value };
};

export const getCampaignMediaForAccess = async (
  row: CampaignMediaRow,
  access: DeveloperCockpitAccess,
) => {
  assertMediaAccess(row, access);
  const record = await getCampaignMediaRecord(row.id);
  const derivatives = access.isOwner || row.ingesting_contributor_id === access.user.id
    ? record.derivatives
    : record.derivatives.filter((derivative) => derivative.exposure === 'public');
  return mapMediaRow(row, derivatives);
};

const assertCampaignFilterAccess = async (
  campaignId: string,
  access: DeveloperCockpitAccess,
) => {
  const { data, error } = await requireCockpitDatabase()
    .from('cardforge_social_campaigns')
    .select('contributor_id')
    .eq('id', campaignId)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to authorize campaign media.', error);
  const contributorId = readFirstDatabaseRow<{ contributor_id: string }>(data)
    ?.contributor_id;
  if (!contributorId) {
    throw new DeveloperCockpitStoreError('Campaign package not found.', 404);
  }
  if (!access.isOwner && contributorId !== access.user.id) {
    throw new DeveloperCockpitStoreError('Campaign media access denied.', 403);
  }
};

const loadMediaDerivatives = async (mediaIds: string[]) => {
  if (!mediaIds.length) return [];
  const { data, error } = await requireCockpitDatabase()
    .from('cardforge_campaign_media_derivatives')
    .select(DERIVATIVE_COLUMNS)
    .in('parent_media_id', mediaIds);
  if (error) {
    throwCockpitDatabaseError(
      'Unable to load campaign-media derivatives.',
      error,
    );
  }
  return readDatabaseRows<DerivativeRow>(data);
};

export const getAuthorizedCampaignMedia = async (
  access: DeveloperCockpitAccess,
  filters: { query?: string; state?: string; campaignId?: string } = {},
): Promise<CampaignMedia[]> => {
  if (filters.campaignId) {
    await assertCampaignFilterAccess(filters.campaignId, access);
  }

  const supabase = requireCockpitDatabase();
  let query = supabase
    .from('cardforge_campaign_media')
    .select(MEDIA_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200);
  if (!access.isOwner) {
    const contributorId = access.user.id.replace(/[,%()]/g, '');
    query = query.or(
      `ingesting_contributor_id.eq.${contributorId},review_state.in.(approved,public)`,
    );
  }
  if (
    filters.state
    && ['private', 'needs_review', 'approved', 'public', 'archived'].includes(filters.state)
  ) {
    query = query.eq('review_state', filters.state);
  }
  if (filters.query) {
    const search = filters.query.replace(/[,%()]/g, '').slice(0, 120);
    query = query.or(
      `original_filename.ilike.%${search}%,creator_credit.ilike.%${search}%,reusable_caption.ilike.%${search}%,reusable_description.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throwCockpitDatabaseError('Unable to load campaign media library.', error);
  let rows = readDatabaseRows<CampaignMediaRow>(data);
  if (filters.campaignId) {
    const linkedResult = await supabase
      .from('cardforge_social_campaign_media_attachments')
      .select('media_id')
      .eq('campaign_id', filters.campaignId);
    if (linkedResult.error) {
      throwCockpitDatabaseError(
        'Unable to filter campaign media.',
        linkedResult.error,
      );
    }
    const ids = new Set(
      readDatabaseRows<{ media_id: string }>(linkedResult.data)
        .map((row) => row.media_id),
    );
    rows = rows.filter((row) => ids.has(row.id));
  }

  const mediaIds = rows.map((row) => row.id);
  const derivatives = await loadMediaDerivatives(mediaIds);
  if (!access.isOwner) {
    return rows.map((row) => mapMediaRow(
      row,
      derivatives.filter((derivative) => (
        derivative.parent_media_id === row.id
        && (
          row.ingesting_contributor_id === access.user.id
          || derivative.exposure === 'public'
        )
      )),
    ));
  }

  const attachmentResult = mediaIds.length
    ? await supabase
      .from('cardforge_social_campaign_media_attachments')
      .select('media_id,campaign_id')
      .in('media_id', mediaIds)
    : { data: [], error: null };
  if (attachmentResult.error) {
    throwCockpitDatabaseError(
      'Unable to load campaign-media relationships.',
      attachmentResult.error,
    );
  }
  const attachments = readDatabaseRows<{
    media_id: string;
    campaign_id: string;
  }>(attachmentResult.data);
  const jobsResult = await supabase
    .from('cardforge_social_publish_jobs')
    .select('campaign_id')
    .limit(500);
  if (jobsResult.error) {
    throwCockpitDatabaseError(
      'Unable to load media publication history.',
      jobsResult.error,
    );
  }
  const jobs = readDatabaseRows<{ campaign_id: string }>(jobsResult.data);

  return rows.map((row) => {
    const campaignIds = [...new Set(
      attachments
        .filter((attachment) => attachment.media_id === row.id)
        .map((attachment) => attachment.campaign_id),
    )];
    return mapMediaRow(
      row,
      derivatives.filter((derivative) => derivative.parent_media_id === row.id),
      campaignIds,
      jobs.filter((job) => campaignIds.includes(job.campaign_id)).length,
    );
  });
};

export const getPublicCampaignMediaUrl = async (
  mediaId: string,
  derivativeId: string | null,
): Promise<string> => {
  const { derivatives } = await getCampaignMediaRecord(mediaId);
  const derivative = derivativeId
    ? derivatives.find((item) => item.id === derivativeId)
    : derivatives.find((item) => (
      item.purpose === 'public_original' && item.exposure === 'public'
    ));
  if (
    !derivative
    || derivative.exposure !== 'public'
    || derivative.storage_bucket !== SOCIAL_PUBLIC_MEDIA_BUCKET
  ) {
    throw new DeveloperCockpitStoreError(
      'Approved public media is required before provider delivery.',
      409,
    );
  }
  return requireCockpitDatabase().storage
    .from(derivative.storage_bucket)
    .getPublicUrl(derivative.storage_path).data.publicUrl;
};
