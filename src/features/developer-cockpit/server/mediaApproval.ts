import { randomUUID } from 'node:crypto';

import {
  canTransitionCampaign,
  type SocialCampaign,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import { getAllowedCampaignActions } from '@/features/developer-cockpit/server/campaignActions';
import { SOCIAL_PUBLIC_MEDIA_BUCKET } from '@/features/developer-cockpit/server/media';

import {
  cleanReviewNote,
  DeveloperCockpitStoreError,
  DERIVATIVE_COLUMNS,
  getCampaignMediaRows,
  getCampaignRecord,
  normalizeExpectedVersion,
  readFirstDatabaseRow,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
  type CampaignMediaRow,
  type DerivativeRow,
} from './storeShared';

const createPublicDerivative = async (
  media: CampaignMediaRow,
): Promise<DerivativeRow> => {
  const supabase = requireCockpitDatabase();
  const promotionKey = `${media.id}:public-original`;
  const derivativeId = randomUUID();
  const storagePath = `${media.id}/${randomUUID()}.webp`;
  const { data, error } = await supabase
    .from('cardforge_campaign_media_derivatives')
    .insert({
      id: derivativeId,
      parent_media_id: media.id,
      purpose: 'public_original',
      width: media.width,
      height: media.height,
      mime_type: 'image/webp',
      byte_count: media.normalized_byte_count,
      storage_bucket: SOCIAL_PUBLIC_MEDIA_BUCKET,
      storage_path: storagePath,
      exposure: 'private',
      promotion_key: promotionKey,
    })
    .select(DERIVATIVE_COLUMNS)
    .limit(1);

  const inserted = readFirstDatabaseRow<DerivativeRow>(data);
  if (!error && inserted) return inserted;
  if (!error) {
    throw new DeveloperCockpitStoreError(
      'Preparing approved media did not return its derivative.',
    );
  }
  if (!/duplicate key|unique/i.test(error.message)) {
    throwCockpitDatabaseError('Unable to prepare the approved media derivative.', error);
  }

  const refreshed = await getCampaignMediaRows([media.id]);
  const concurrent = refreshed.derivatives.find((candidate) => (
    candidate.promotion_key === promotionKey
  ));
  if (!concurrent) {
    throw new DeveloperCockpitStoreError(
      'Unable to prepare the approved media derivative.',
    );
  }
  return concurrent;
};

const prepareMediaDerivative = async (mediaId: string): Promise<string> => {
  const supabase = requireCockpitDatabase();
  const { rows, derivatives } = await getCampaignMediaRows([mediaId]);
  const media = rows[0];
  if (!media) throw new DeveloperCockpitStoreError('Campaign media not found.', 404);

  const promotionKey = `${media.id}:public-original`;
  let derivative = derivatives.find((candidate) => (
    candidate.promotion_key === promotionKey
  ));
  if (derivative?.exposure === 'public') return derivative.id;
  derivative ??= await createPublicDerivative(media);

  const { data: source, error: sourceError } = await supabase.storage
    .from(media.normalized_storage_bucket)
    .download(media.normalized_storage_path);
  if (sourceError) {
    throwCockpitDatabaseError(
      'Unable to read protected campaign media for approval.',
      sourceError,
    );
  }
  if (!source) {
    throw new DeveloperCockpitStoreError(
      'Protected campaign media is unavailable.',
      404,
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(SOCIAL_PUBLIC_MEDIA_BUCKET)
    .upload(derivative.storage_path, await source.arrayBuffer(), {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: true,
    });
  if (uploadError) {
    throwCockpitDatabaseError('Unable to promote approved campaign media.', uploadError);
  }

  return derivative.id;
};

export const approveSocialCampaign = async (
  access: DeveloperCockpitAccess,
  campaignId: string,
  expectedVersion: unknown,
  reviewNote: unknown,
): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  if (!access.isOwner) {
    throw new DeveloperCockpitStoreError('Owner approval is required.', 403);
  }

  const campaign = await getCampaignRecord(campaignId, access);
  if (campaign.status === 'approved') {
    return {
      campaign,
      allowedNextActions: getAllowedCampaignActions(campaign, access),
    };
  }
  if (!canTransitionCampaign(campaign.status, 'approved', 'owner')) {
    throw new DeveloperCockpitStoreError(
      `A ${campaign.status} campaign cannot be approved.`,
      409,
    );
  }

  const version = normalizeExpectedVersion(expectedVersion);
  if (version !== campaign.version) {
    throw new DeveloperCockpitStoreError(
      'This campaign changed elsewhere. Reload before approving.',
      409,
    );
  }

  const selections: Array<{ attachment_id: string; derivative_id: string }> = [];
  for (const attachment of campaign.variants.flatMap((variant) => variant.attachments)) {
    const selected = attachment.derivativeId
      ? attachment.media.derivatives.find((derivative) => (
        derivative.id === attachment.derivativeId && derivative.exposure === 'public'
      ))
      : null;
    selections.push({
      attachment_id: attachment.id,
      derivative_id: selected?.id ?? await prepareMediaDerivative(attachment.mediaId),
    });
  }

  const { data, error } = await requireCockpitDatabase().rpc(
    'cardforge_finalize_social_campaign_approval',
    {
      p_campaign_id: campaign.id,
      p_expected_version: version,
      p_reviewer_id: access.user.id,
      p_review_note: cleanReviewNote(reviewNote),
      p_approved_at: new Date().toISOString(),
      p_selections: selections,
    },
  );
  if (error) throwCockpitDatabaseError('Unable to approve the campaign package.', error);
  if (data !== true) {
    throw new DeveloperCockpitStoreError(
      'This campaign changed elsewhere. Reload before approving.',
      409,
    );
  }

  const approved = await getCampaignRecord(campaign.id, access);
  return {
    campaign: approved,
    allowedNextActions: getAllowedCampaignActions(approved, access),
  };
};
