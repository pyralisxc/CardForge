import { randomUUID } from 'node:crypto';

import {
  canTransitionCampaign,
  normalizeCampaignInput,
  type SocialCampaign,
  type SocialCampaignStatus,
  type SocialCampaignVariant,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import {
  SOCIAL_PUBLIC_MEDIA_BUCKET,
  SOCIAL_SOURCE_BUCKET,
} from '@/features/developer-cockpit/server/media';
import {
  CAMPAIGN_COLUMNS,
  cleanReviewNote,
  DeveloperCockpitStoreError,
  getCampaignRecord,
  mapCampaignRow,
  normalizeExpectedVersion,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
  type CampaignRow,
} from './storeShared';

const requireCampaignOwnership = (
  campaign: SocialCampaign,
  access: DeveloperCockpitAccess,
) => {
  if (!access.isOwner && campaign.contributorId !== access.user.id) {
    throw new DeveloperCockpitStoreError('You can only change your own campaign packages.', 403);
  }
};

const requireCampaignMediaOwnership = (
  variants: SocialCampaignVariant[],
  access: DeveloperCockpitAccess,
) => {
  for (const variant of variants) {
    for (const media of variant.media) {
      if (!media.sourcePath) continue;
      if (media.sourceBucket !== SOCIAL_SOURCE_BUCKET) {
        throw new DeveloperCockpitStoreError('Protected campaign media must use the CardForge source bucket.', 400);
      }
      if (!access.isOwner && !media.sourcePath.startsWith(`${access.user.id}/`)) {
        throw new DeveloperCockpitStoreError('You can only attach campaign media uploaded by your account.', 403);
      }
    }
  }
};

export const createSocialCampaign = async (
  access: DeveloperCockpitAccess,
  input: Parameters<typeof normalizeCampaignInput>[0],
): Promise<SocialCampaign> => {
  const supabase = requireCockpitDatabase();
  const normalized = normalizeCampaignInput(input);
  if (!normalized.ok) throw new DeveloperCockpitStoreError(normalized.message, 400);
  requireCampaignMediaOwnership(normalized.value.variants, access);
  const { data, error } = await supabase
    .from('cardforge_social_campaigns')
    .insert({
      contributor_id: access.user.id,
      contributor_email: access.email,
      contributor_name: access.displayName,
      title: normalized.value.title,
      objective: normalized.value.objective,
      destination_url: normalized.value.destinationUrl,
      source_reference: normalized.value.sourceReference,
      license_notes: normalized.value.licenseNotes,
      variants: normalized.value.variants,
      requested_publish_at: normalized.value.requestedPublishAt,
      status: 'draft',
    })
    .select(CAMPAIGN_COLUMNS)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to create the campaign package.', error);
  return mapCampaignRow(data?.[0] as CampaignRow);
};

export const saveSocialCampaign = async ({
  access,
  campaignId,
  expectedVersion,
  input,
}: {
  access: DeveloperCockpitAccess;
  campaignId: string;
  expectedVersion: unknown;
  input: Parameters<typeof normalizeCampaignInput>[0];
}): Promise<SocialCampaign> => {
  const supabase = requireCockpitDatabase();
  const campaign = await getCampaignRecord(campaignId);
  requireCampaignOwnership(campaign, access);
  if (campaign.status !== 'draft' && campaign.status !== 'changes_requested') {
    throw new DeveloperCockpitStoreError('Only draft or changes-requested campaigns can be edited.', 409);
  }
  const normalized = normalizeCampaignInput(input);
  if (!normalized.ok) throw new DeveloperCockpitStoreError(normalized.message, 400);
  requireCampaignMediaOwnership(normalized.value.variants, access);
  const version = normalizeExpectedVersion(expectedVersion);
  const { data, error } = await supabase
    .from('cardforge_social_campaigns')
    .update({
      title: normalized.value.title,
      objective: normalized.value.objective,
      destination_url: normalized.value.destinationUrl,
      source_reference: normalized.value.sourceReference,
      license_notes: normalized.value.licenseNotes,
      variants: normalized.value.variants,
      requested_publish_at: normalized.value.requestedPublishAt,
      status: campaign.status === 'changes_requested' ? 'draft' : campaign.status,
      version: version + 1,
    })
    .eq('id', campaign.id)
    .eq('version', version)
    .select(CAMPAIGN_COLUMNS)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to save the campaign package.', error);
  const row = data?.[0] as CampaignRow | undefined;
  if (!row) throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before saving.', 409);
  return mapCampaignRow(row);
};

const transitionCampaign = async ({
  access,
  campaignId,
  expectedVersion,
  to,
  reviewNote = '',
}: {
  access: DeveloperCockpitAccess;
  campaignId: string;
  expectedVersion: unknown;
  to: SocialCampaignStatus;
  reviewNote?: unknown;
}): Promise<SocialCampaign> => {
  const supabase = requireCockpitDatabase();
  const campaign = await getCampaignRecord(campaignId);
  requireCampaignOwnership(campaign, access);
  const actor = access.isOwner ? 'owner' : 'contributor';
  if (!canTransitionCampaign(campaign.status, to, actor)) {
    throw new DeveloperCockpitStoreError(`A ${campaign.status} campaign cannot move to ${to}.`, 409);
  }
  const version = normalizeExpectedVersion(expectedVersion);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('cardforge_social_campaigns')
    .update({
      status: to,
      version: version + 1,
      ...(to === 'submitted' ? { submitted_at: now, review_note: '' } : {}),
      ...(to === 'changes_requested' || to === 'cancelled'
        ? { review_note: cleanReviewNote(reviewNote), reviewed_by: access.isOwner ? access.user.id : null }
        : {}),
      ...(to === 'approved' ? { approved_at: now, reviewed_by: access.user.id, review_note: cleanReviewNote(reviewNote) } : {}),
    })
    .eq('id', campaign.id)
    .eq('version', version)
    .select(CAMPAIGN_COLUMNS)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to update the campaign workflow.', error);
  const row = data?.[0] as CampaignRow | undefined;
  if (!row) throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before reviewing.', 409);
  return mapCampaignRow(row);
};

export const submitSocialCampaign = (
  access: DeveloperCockpitAccess,
  campaignId: string,
  expectedVersion: unknown,
) => transitionCampaign({ access, campaignId, expectedVersion, to: 'submitted' });

export const requestSocialCampaignChanges = (
  access: DeveloperCockpitAccess,
  campaignId: string,
  expectedVersion: unknown,
  reviewNote: unknown,
) => transitionCampaign({
  access,
  campaignId,
  expectedVersion,
  to: 'changes_requested',
  reviewNote,
});

export const cancelSocialCampaign = (
  access: DeveloperCockpitAccess,
  campaignId: string,
  expectedVersion: unknown,
  reviewNote: unknown,
) => transitionCampaign({
  access,
  campaignId,
  expectedVersion,
  to: 'cancelled',
  reviewNote,
});

const promoteCampaignMedia = async (
  campaign: SocialCampaign,
): Promise<SocialCampaignVariant[]> => {
  const supabase = requireCockpitDatabase();
  const promoted: SocialCampaignVariant[] = [];
  for (const variant of campaign.variants) {
    const media = [];
    for (const item of variant.media) {
      if (item.publicUrl) {
        media.push(item);
        continue;
      }
      if (item.sourceBucket !== SOCIAL_SOURCE_BUCKET || !item.sourcePath) {
        throw new DeveloperCockpitStoreError('Campaign media must come from the protected CardForge source bucket.', 400);
      }
      const { data: source, error: downloadError } = await supabase.storage
        .from(SOCIAL_SOURCE_BUCKET)
        .download(item.sourcePath);
      if (downloadError || !source) {
        throwCockpitDatabaseError('Unable to read protected campaign media for approval.', downloadError);
      }
      const publicPath = `${campaign.id}/${randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(SOCIAL_PUBLIC_MEDIA_BUCKET)
        .upload(publicPath, await (source as Blob).arrayBuffer(), {
          cacheControl: '31536000',
          contentType: 'image/webp',
          upsert: false,
        });
      if (uploadError) throwCockpitDatabaseError('Unable to promote approved campaign media.', uploadError);
      const publicUrl = supabase.storage.from(SOCIAL_PUBLIC_MEDIA_BUCKET).getPublicUrl(publicPath).data.publicUrl;
      media.push({ ...item, publicUrl });
    }
    promoted.push({ ...variant, media });
  }
  return promoted;
};

export const approveSocialCampaign = async (
  access: DeveloperCockpitAccess,
  campaignId: string,
  expectedVersion: unknown,
  reviewNote: unknown,
): Promise<SocialCampaign> => {
  const supabase = requireCockpitDatabase();
  const campaign = await getCampaignRecord(campaignId);
  if (!access.isOwner) throw new DeveloperCockpitStoreError('Owner approval is required.', 403);
  if (!canTransitionCampaign(campaign.status, 'approved', 'owner')) {
    throw new DeveloperCockpitStoreError(`A ${campaign.status} campaign cannot be approved.`, 409);
  }
  const version = normalizeExpectedVersion(expectedVersion);
  if (version !== campaign.version) {
    throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before approving.', 409);
  }
  const variants = await promoteCampaignMedia(campaign);
  const { data, error } = await supabase
    .from('cardforge_social_campaigns')
    .update({
      variants,
      status: 'approved',
      approved_at: new Date().toISOString(),
      reviewed_by: access.user.id,
      review_note: cleanReviewNote(reviewNote),
      version: version + 1,
    })
    .eq('id', campaign.id)
    .eq('version', version)
    .select(CAMPAIGN_COLUMNS)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to approve the campaign package.', error);
  const row = data?.[0] as CampaignRow | undefined;
  if (!row) throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before approving.', 409);
  return mapCampaignRow(row);
};
