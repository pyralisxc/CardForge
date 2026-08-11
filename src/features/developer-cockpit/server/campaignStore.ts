import type {
  CampaignInput,
  SocialCampaign,
  SocialCampaignStatus,
} from '@/features/developer-cockpit/model';
import {
  canTransitionCampaign,
  normalizeCampaignInput,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import { getAllowedCampaignActions } from '@/features/developer-cockpit/server/campaignActions';

import {
  cleanReviewNote,
  CAMPAIGN_COLUMNS,
  DeveloperCockpitStoreError,
  getCampaignMediaRows,
  getCampaignRecord,
  hydrateCampaignRows,
  normalizeExpectedVersion,
  readDatabaseRows,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
  type CampaignRow,
} from './storeShared';

export { getAllowedCampaignActions } from './campaignActions';

type NormalizedCampaign = Extract<
  ReturnType<typeof normalizeCampaignInput>,
  { ok: true }
>['value'];

const CAMPAIGN_STATUSES = new Set<SocialCampaignStatus>([
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'provider_draft',
  'scheduled',
  'published',
  'failed',
  'cancelled',
]);

const requireCampaignOwnership = (
  campaign: SocialCampaign,
  access: DeveloperCockpitAccess,
) => {
  if (!access.isOwner && campaign.contributorId !== access.user.id) {
    throw new DeveloperCockpitStoreError(
      'You can only change your own campaign packages.',
      403,
    );
  }
};

const normalizeIdempotencyKey = (value: unknown) => (
  typeof value === 'string' && value.length >= 16 && value.length <= 160
    ? value
    : ''
);

const assertMediaAttachmentAccess = async (
  input: NormalizedCampaign,
  access: DeveloperCockpitAccess,
) => {
  const attachments = input.variants.flatMap((variant) => variant.attachments);
  const mediaIds = [...new Set(attachments.map((attachment) => attachment.mediaId))];
  const { rows, derivatives } = await getCampaignMediaRows(mediaIds);
  if (rows.length !== mediaIds.length) {
    throw new DeveloperCockpitStoreError(
      'One or more campaign media items no longer exist.',
      404,
    );
  }

  const mediaById = new Map(rows.map((media) => [media.id, media]));
  const derivativeById = new Map(derivatives.map((derivative) => [derivative.id, derivative]));
  for (const attachment of attachments) {
    const media = mediaById.get(attachment.mediaId)!;
    const mayReuse = access.isOwner
      || media.ingesting_contributor_id === access.user.id
      || ['approved', 'public'].includes(media.review_state);
    if (!mayReuse) {
      throw new DeveloperCockpitStoreError(
        'You cannot attach another contributor’s private media.',
        403,
      );
    }

    if (!attachment.derivativeId) continue;
    const derivative = derivativeById.get(attachment.derivativeId);
    if (
      !derivative
      || derivative.parent_media_id !== attachment.mediaId
      || derivative.exposure !== 'public'
    ) {
      throw new DeveloperCockpitStoreError(
        'Choose a public derivative that belongs to the selected media item.',
        400,
      );
    }
  }
};

const serializeRelationships = (input: NormalizedCampaign) => ({
  attachments: input.variants.flatMap((variant) => (
    variant.attachments.map((attachment) => ({
      service: variant.service,
      media_id: attachment.mediaId,
      derivative_id: attachment.derivativeId,
      display_order: attachment.displayOrder,
      alt_text: attachment.altText,
      caption_override: attachment.captionOverride,
      crop_intent: attachment.cropIntent,
    }))
  )),
  associations: input.associations.map((association) => ({
    kind: association.kind,
    external_key: association.externalKey,
    reference_url: association.referenceUrl,
    title_snapshot: association.titleSnapshot,
    metadata_snapshot: association.metadataSnapshot,
    note: association.note,
  })),
});

const campaignCopies = (input: NormalizedCampaign) => (
  input.variants.map(({ service, text }) => ({ service, text }))
);

export const listSocialCampaigns = async ({
  access,
  status,
  cursor,
  limit,
}: {
  access: DeveloperCockpitAccess;
  status?: string;
  cursor: number;
  limit: number;
}): Promise<{ campaigns: SocialCampaign[]; nextCursor: number | null }> => {
  if (status && !CAMPAIGN_STATUSES.has(status as SocialCampaignStatus)) {
    throw new DeveloperCockpitStoreError('Choose a supported campaign status.', 400);
  }

  const supabase = requireCockpitDatabase();
  let query = supabase
    .from('cardforge_social_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .order('updated_at', { ascending: false });
  if (!access.isOwner) query = query.eq('contributor_id', access.user.id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query.range(cursor, cursor + limit);
  if (error) throwCockpitDatabaseError('Unable to list campaign packages.', error);
  const rows = readDatabaseRows<CampaignRow>(data);
  const hasMore = rows.length > limit;
  return {
    campaigns: await hydrateCampaignRows(rows.slice(0, limit), access),
    nextCursor: hasMore ? cursor + limit : null,
  };
};

export const createSocialCampaign = async (
  access: DeveloperCockpitAccess,
  input: CampaignInput & { idempotencyKey?: unknown },
): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  const key = normalizeIdempotencyKey(input.idempotencyKey);
  if (!key) {
    throw new DeveloperCockpitStoreError(
      'A client-generated campaign idempotency key is required.',
      400,
    );
  }

  const normalized = normalizeCampaignInput(input);
  if (!normalized.ok) throw new DeveloperCockpitStoreError(normalized.message, 400);
  await assertMediaAttachmentAccess(normalized.value, access);
  const relationships = serializeRelationships(normalized.value);
  const { data, error } = await requireCockpitDatabase().rpc(
    'cardforge_create_social_campaign',
    {
      p_contributor_id: access.user.id,
      p_contributor_email: access.email,
      p_contributor_name: access.displayName,
      p_idempotency_key: key,
      p_title: normalized.value.title,
      p_objective: normalized.value.objective,
      p_destination_url: normalized.value.destinationUrl,
      p_production_note: normalized.value.productionNote,
      p_variants: campaignCopies(normalized.value),
      p_requested_publish_at: normalized.value.requestedPublishAt,
      p_attachments: relationships.attachments,
      p_associations: relationships.associations,
    },
  );
  if (error) throwCockpitDatabaseError('Unable to create the campaign package.', error);
  if (typeof data !== 'string') {
    throw new DeveloperCockpitStoreError(
      'Campaign creation did not return an identifier.',
    );
  }

  const campaign = await getCampaignRecord(data, access);
  return {
    campaign,
    allowedNextActions: getAllowedCampaignActions(campaign, access),
  };
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
  input: CampaignInput;
}): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  const campaign = await getCampaignRecord(campaignId, access);
  requireCampaignOwnership(campaign, access);
  if (!['draft', 'changes_requested'].includes(campaign.status)) {
    throw new DeveloperCockpitStoreError(
      'Only draft or changes-requested campaigns can be edited.',
      409,
    );
  }

  const normalized = normalizeCampaignInput(input);
  if (!normalized.ok) throw new DeveloperCockpitStoreError(normalized.message, 400);
  await assertMediaAttachmentAccess(normalized.value, access);
  const version = normalizeExpectedVersion(expectedVersion);
  const relationships = serializeRelationships(normalized.value);
  const { data, error } = await requireCockpitDatabase().rpc(
    'cardforge_update_social_campaign',
    {
      p_campaign_id: campaign.id,
      p_expected_version: version,
      p_actor_id: access.user.id,
      p_title: normalized.value.title,
      p_objective: normalized.value.objective,
      p_destination_url: normalized.value.destinationUrl,
      p_production_note: normalized.value.productionNote,
      p_variants: campaignCopies(normalized.value),
      p_requested_publish_at: normalized.value.requestedPublishAt,
      p_attachments: relationships.attachments,
      p_associations: relationships.associations,
    },
  );
  if (error) throwCockpitDatabaseError('Unable to save the campaign package.', error);
  if (data !== true) {
    throw new DeveloperCockpitStoreError(
      'This campaign changed elsewhere. Reload before saving.',
      409,
    );
  }

  const saved = await getCampaignRecord(campaign.id, access);
  return {
    campaign: saved,
    allowedNextActions: getAllowedCampaignActions(saved, access),
  };
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
}): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  const campaign = await getCampaignRecord(campaignId, access);
  requireCampaignOwnership(campaign, access);
  const actor = access.isOwner ? 'owner' : 'contributor';
  if (!canTransitionCampaign(campaign.status, to, actor)) {
    throw new DeveloperCockpitStoreError(
      `A ${campaign.status} campaign cannot move to ${to}.`,
      409,
    );
  }

  const version = normalizeExpectedVersion(expectedVersion);
  const { data, error } = await requireCockpitDatabase()
    .from('cardforge_social_campaigns')
    .update({
      status: to,
      version: version + 1,
      ...(to === 'submitted'
        ? { submitted_at: new Date().toISOString(), review_note: '' }
        : {}),
      ...(to === 'changes_requested' || to === 'cancelled'
        ? {
          review_note: cleanReviewNote(reviewNote),
          reviewed_by: access.isOwner ? access.user.id : null,
        }
        : {}),
    })
    .eq('id', campaign.id)
    .eq('version', version)
    .select('id')
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to update the campaign workflow.', error);
  if (!data?.[0]) {
    throw new DeveloperCockpitStoreError(
      'This campaign changed elsewhere. Reload before reviewing.',
      409,
    );
  }

  const changed = await getCampaignRecord(campaign.id, access);
  return {
    campaign: changed,
    allowedNextActions: getAllowedCampaignActions(changed, access),
  };
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

export const validateCampaignPackage = (input: CampaignInput) => {
  const normalized = normalizeCampaignInput(input);
  if (!normalized.ok) {
    return {
      normalized: null,
      blockingErrors: [normalized.message],
      readinessWarnings: [],
      allowedNextActions: [],
    };
  }
  const warnings = [
    normalized.value.productionNote
      ? ''
      : 'Add a production note so reviewers understand the release context.',
    normalized.value.variants.some((variant) => !variant.attachments.length)
      ? 'One or more channels are text-only.'
      : '',
    normalized.value.associations.length
      ? ''
      : 'Link a PR, release, feature, asset, or recording when this package supports shipped work.',
  ].filter(Boolean);
  return {
    normalized: normalized.value,
    blockingErrors: [],
    readinessWarnings: warnings,
    allowedNextActions: ['create_draft'],
  };
};

export const updateCampaignAssociations = async ({
  access,
  campaignId,
  expectedVersion,
  associations,
}: {
  access: DeveloperCockpitAccess;
  campaignId: string;
  expectedVersion: unknown;
  associations: unknown;
}) => {
  const campaign = await getCampaignRecord(campaignId, access);
  return saveSocialCampaign({
    access,
    campaignId,
    expectedVersion,
    input: {
      title: campaign.title,
      objective: campaign.objective,
      destinationUrl: campaign.destinationUrl,
      productionNote: campaign.productionNote,
      requestedPublishAt: campaign.requestedPublishAt,
      variants: campaign.variants.map((variant) => ({
        service: variant.service,
        text: variant.text,
        attachments: variant.attachments.map((attachment) => ({
          mediaId: attachment.mediaId,
          derivativeId: attachment.derivativeId,
          displayOrder: attachment.displayOrder,
          altText: attachment.altText,
          captionOverride: attachment.captionOverride,
          cropIntent: attachment.cropIntent,
        })),
      })),
      associations,
    },
  });
};
