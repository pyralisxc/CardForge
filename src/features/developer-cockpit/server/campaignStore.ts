import type { CampaignInput, SocialCampaign, SocialCampaignStatus } from '@/features/developer-cockpit/model';
import { canTransitionCampaign, normalizeCampaignInput } from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import { SOCIAL_PUBLIC_MEDIA_BUCKET } from '@/features/developer-cockpit/server/media';
import {
  CAMPAIGN_COLUMNS,
  cleanReviewNote,
  DeveloperCockpitStoreError,
  getCampaignMediaRows,
  getCampaignRecord,
  hydrateCampaignRows,
  normalizeExpectedVersion,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
  type CampaignRow,
} from './storeShared';

const requireCampaignOwnership = (campaign: SocialCampaign, access: DeveloperCockpitAccess) => { if (!access.isOwner && campaign.contributorId !== access.user.id) throw new DeveloperCockpitStoreError('You can only change your own campaign packages.', 403); };
const idempotencyKey = (value: unknown) => typeof value === 'string' && value.length >= 16 && value.length <= 160 ? value : '';
const nextActions = (campaign: SocialCampaign, access: DeveloperCockpitAccess): string[] => {
  if (access.isOwner && campaign.status === 'submitted') return ['request_changes', 'approve'];
  if (!access.isOwner && ['draft', 'changes_requested'].includes(campaign.status)) return ['save', 'submit', 'cancel'];
  return campaign.status === 'approved' && access.isOwner ? ['create_provider_draft'] : [];
};
const assertMediaAttachmentAccess = async (mediaIds: string[], access: DeveloperCockpitAccess) => {
  const { rows } = await getCampaignMediaRows(mediaIds);
  if (rows.length !== mediaIds.length) throw new DeveloperCockpitStoreError('One or more campaign media items no longer exist.', 404);
  for (const media of rows) if (!access.isOwner && media.ingesting_contributor_id !== access.user.id && !['approved', 'public'].includes(media.review_state)) throw new DeveloperCockpitStoreError('You cannot attach another contributor’s private media.', 403);
};
const replaceCampaignRelationships = async (campaignId: string, input: Extract<ReturnType<typeof normalizeCampaignInput>, { ok: true }>['value'], createdBy: string) => {
  const supabase = requireCockpitDatabase(); const attachments = input.variants.flatMap((variant) => variant.attachments.map((attachment) => ({ campaign_id: campaignId, service: variant.service, media_id: attachment.mediaId, derivative_id: attachment.derivativeId, display_order: attachment.displayOrder, alt_text: attachment.altText, caption_override: attachment.captionOverride, crop_intent: attachment.cropIntent })));
  const { error: deleteAttachmentsError } = await supabase.from('cardforge_social_campaign_media_attachments').delete().eq('campaign_id', campaignId);
  if (deleteAttachmentsError) throwCockpitDatabaseError('Unable to replace campaign media attachments.', deleteAttachmentsError);
  if (attachments.length) { const { error } = await supabase.from('cardforge_social_campaign_media_attachments').insert(attachments); if (error) throwCockpitDatabaseError('Unable to attach campaign media.', error); }
  const { error: deleteAssociationsError } = await supabase.from('cardforge_social_campaign_associations').delete().eq('campaign_id', campaignId);
  if (deleteAssociationsError) throwCockpitDatabaseError('Unable to replace development associations.', deleteAssociationsError);
  if (input.associations.length) { const { error } = await supabase.from('cardforge_social_campaign_associations').insert(input.associations.map((association) => ({ campaign_id: campaignId, kind: association.kind, external_key: association.externalKey, reference_url: association.referenceUrl, title_snapshot: association.titleSnapshot, metadata_snapshot: association.metadataSnapshot, note: association.note, created_by: createdBy }))); if (error) throwCockpitDatabaseError('Unable to record development associations.', error); }
};

export const createSocialCampaign = async (access: DeveloperCockpitAccess, input: CampaignInput & { idempotencyKey?: unknown }): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  const key = idempotencyKey(input.idempotencyKey); if (!key) throw new DeveloperCockpitStoreError('A client-generated campaign idempotency key is required.', 400);
  const normalized = normalizeCampaignInput(input); if (!normalized.ok) throw new DeveloperCockpitStoreError(normalized.message, 400);
  await assertMediaAttachmentAccess([...new Set(normalized.value.variants.flatMap((variant) => variant.attachments.map((attachment) => attachment.mediaId)))], access);
  const supabase = requireCockpitDatabase();
  const { data: existing, error: existingError } = await supabase.from('cardforge_social_campaigns').select(CAMPAIGN_COLUMNS).eq('contributor_id', access.user.id).eq('creation_idempotency_key', key).limit(1);
  if (existingError) throwCockpitDatabaseError('Unable to check campaign creation.', existingError);
  if (existing?.[0]) { const campaign = (await hydrateCampaignRows([existing[0] as CampaignRow]))[0]!; return { campaign, allowedNextActions: nextActions(campaign, access) }; }
  const { data, error } = await supabase.from('cardforge_social_campaigns').insert({ contributor_id: access.user.id, contributor_email: access.email, contributor_name: access.displayName, creation_idempotency_key: key, title: normalized.value.title, objective: normalized.value.objective, destination_url: normalized.value.destinationUrl, production_note: normalized.value.productionNote, variants: normalized.value.variants.map(({ service, text }) => ({ service, text })), requested_publish_at: normalized.value.requestedPublishAt, status: 'draft' }).select(CAMPAIGN_COLUMNS).limit(1);
  if (error) throwCockpitDatabaseError('Unable to create the campaign package.', error);
  const row = data?.[0] as CampaignRow | undefined; if (!row) throw new DeveloperCockpitStoreError('Campaign creation did not return a resource.');
  await replaceCampaignRelationships(row.id, normalized.value, access.user.id);
  const campaign = await getCampaignRecord(row.id); return { campaign, allowedNextActions: nextActions(campaign, access) };
};

export const saveSocialCampaign = async ({ access, campaignId, expectedVersion, input }: { access: DeveloperCockpitAccess; campaignId: string; expectedVersion: unknown; input: CampaignInput }): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  const campaign = await getCampaignRecord(campaignId); requireCampaignOwnership(campaign, access); if (!['draft', 'changes_requested'].includes(campaign.status)) throw new DeveloperCockpitStoreError('Only draft or changes-requested campaigns can be edited.', 409);
  const normalized = normalizeCampaignInput(input); if (!normalized.ok) throw new DeveloperCockpitStoreError(normalized.message, 400); await assertMediaAttachmentAccess([...new Set(normalized.value.variants.flatMap((variant) => variant.attachments.map((attachment) => attachment.mediaId)))], access);
  const version = normalizeExpectedVersion(expectedVersion); const supabase = requireCockpitDatabase();
  const { data, error } = await supabase.from('cardforge_social_campaigns').update({ title: normalized.value.title, objective: normalized.value.objective, destination_url: normalized.value.destinationUrl, production_note: normalized.value.productionNote, variants: normalized.value.variants.map(({ service, text }) => ({ service, text })), requested_publish_at: normalized.value.requestedPublishAt, status: campaign.status === 'changes_requested' ? 'draft' : campaign.status, version: version + 1 }).eq('id', campaign.id).eq('version', version).select(CAMPAIGN_COLUMNS).limit(1);
  if (error) throwCockpitDatabaseError('Unable to save the campaign package.', error); if (!data?.[0]) throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before saving.', 409);
  await replaceCampaignRelationships(campaign.id, normalized.value, access.user.id); const saved = await getCampaignRecord(campaign.id); return { campaign: saved, allowedNextActions: nextActions(saved, access) };
};

const transitionCampaign = async ({ access, campaignId, expectedVersion, to, reviewNote = '' }: { access: DeveloperCockpitAccess; campaignId: string; expectedVersion: unknown; to: SocialCampaignStatus; reviewNote?: unknown }): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  const campaign = await getCampaignRecord(campaignId); requireCampaignOwnership(campaign, access); const actor = access.isOwner ? 'owner' : 'contributor'; if (!canTransitionCampaign(campaign.status, to, actor)) throw new DeveloperCockpitStoreError(`A ${campaign.status} campaign cannot move to ${to}.`, 409);
  const version = normalizeExpectedVersion(expectedVersion); const now = new Date().toISOString(); const supabase = requireCockpitDatabase();
  const { data, error } = await supabase.from('cardforge_social_campaigns').update({ status: to, version: version + 1, ...(to === 'submitted' ? { submitted_at: now, review_note: '' } : {}), ...(to === 'changes_requested' || to === 'cancelled' ? { review_note: cleanReviewNote(reviewNote), reviewed_by: access.isOwner ? access.user.id : null } : {}), ...(to === 'approved' ? { approved_at: now, reviewed_by: access.user.id, review_note: cleanReviewNote(reviewNote) } : {}) }).eq('id', campaign.id).eq('version', version).select(CAMPAIGN_COLUMNS).limit(1);
  if (error) throwCockpitDatabaseError('Unable to update the campaign workflow.', error); if (!data?.[0]) throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before reviewing.', 409);
  const changed = await getCampaignRecord(campaign.id); return { campaign: changed, allowedNextActions: nextActions(changed, access) };
};
export const submitSocialCampaign = (access: DeveloperCockpitAccess, campaignId: string, expectedVersion: unknown) => transitionCampaign({ access, campaignId, expectedVersion, to: 'submitted' });
export const requestSocialCampaignChanges = (access: DeveloperCockpitAccess, campaignId: string, expectedVersion: unknown, reviewNote: unknown) => transitionCampaign({ access, campaignId, expectedVersion, to: 'changes_requested', reviewNote });
export const cancelSocialCampaign = (access: DeveloperCockpitAccess, campaignId: string, expectedVersion: unknown, reviewNote: unknown) => transitionCampaign({ access, campaignId, expectedVersion, to: 'cancelled', reviewNote });

const promoteMedia = async (mediaId: string, access: DeveloperCockpitAccess): Promise<string> => {
  const supabase = requireCockpitDatabase(); const { rows, derivatives } = await getCampaignMediaRows([mediaId]); const media = rows[0]; if (!media) throw new DeveloperCockpitStoreError('Campaign media not found.', 404);
  const key = `${media.id}:public-original`; let derivative = derivatives.find((candidate) => candidate.purpose === 'public_original' && candidate.exposure === 'public'); if (derivative) return derivative.id;
  const publicPath = `${media.id}/public-original.webp`; const { data: inserted, error: insertError } = await supabase.from('cardforge_campaign_media_derivatives').upsert({ parent_media_id: media.id, purpose: 'public_original', width: media.width, height: media.height, mime_type: 'image/webp', byte_count: media.normalized_byte_count, storage_bucket: SOCIAL_PUBLIC_MEDIA_BUCKET, storage_path: publicPath, exposure: 'private', promotion_key: key }, { onConflict: 'parent_media_id,purpose,promotion_key' }).select('id').limit(1);
  if (insertError) throwCockpitDatabaseError('Unable to prepare the approved media derivative.', insertError); const derivativeId = inserted?.[0]?.id as string | undefined; if (!derivativeId) throw new DeveloperCockpitStoreError('Media promotion did not return a derivative.');
  const { data: source, error: sourceError } = await supabase.storage.from(media.normalized_storage_bucket).download(media.normalized_storage_path); if (sourceError) throwCockpitDatabaseError('Unable to read protected campaign media for approval.', sourceError); if (!source) throw new DeveloperCockpitStoreError('Protected campaign media is unavailable.', 404);
  const sourceBuffer = await source.arrayBuffer(); const { error: uploadError } = await supabase.storage.from(SOCIAL_PUBLIC_MEDIA_BUCKET).upload(publicPath, sourceBuffer, { cacheControl: '31536000', contentType: 'image/webp', upsert: true }); if (uploadError) throwCockpitDatabaseError('Unable to promote approved campaign media.', uploadError);
  const now = new Date().toISOString(); const [{ error: derivativeError }, { error: mediaError }] = await Promise.all([supabase.from('cardforge_campaign_media_derivatives').update({ exposure: 'public', approved_by: access.user.id, approved_at: now }).eq('id', derivativeId), supabase.from('cardforge_campaign_media').update({ review_state: 'public', reviewed_by: access.user.id, reviewed_at: now }).eq('id', media.id)]); if (derivativeError || mediaError) throwCockpitDatabaseError('Unable to finalize approved campaign media.', derivativeError ?? mediaError); return derivativeId;
};
export const approveSocialCampaign = async (access: DeveloperCockpitAccess, campaignId: string, expectedVersion: unknown, reviewNote: unknown): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  if (!access.isOwner) throw new DeveloperCockpitStoreError('Owner approval is required.', 403); const campaign = await getCampaignRecord(campaignId); if (campaign.status === 'approved') return { campaign, allowedNextActions: nextActions(campaign, access) }; if (!canTransitionCampaign(campaign.status, 'approved', 'owner')) throw new DeveloperCockpitStoreError(`A ${campaign.status} campaign cannot be approved.`, 409); const version = normalizeExpectedVersion(expectedVersion); if (version !== campaign.version) throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before approving.', 409);
  const promoted = new Map<string, string>(); for (const attachment of campaign.variants.flatMap((variant) => variant.attachments)) promoted.set(attachment.id, attachment.derivativeId ?? await promoteMedia(attachment.mediaId, access));
  const supabase = requireCockpitDatabase(); for (const [attachmentId, derivativeId] of promoted) { const { error } = await supabase.from('cardforge_social_campaign_media_attachments').update({ derivative_id: derivativeId }).eq('id', attachmentId); if (error) throwCockpitDatabaseError('Unable to preserve approved media selection.', error); }
  const { data, error } = await supabase.from('cardforge_social_campaigns').update({ status: 'approved', approved_at: new Date().toISOString(), reviewed_by: access.user.id, review_note: cleanReviewNote(reviewNote), version: version + 1 }).eq('id', campaign.id).eq('version', version).select('id').limit(1); if (error) throwCockpitDatabaseError('Unable to approve the campaign package.', error); if (!data?.[0]) throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before approving.', 409); const approved = await getCampaignRecord(campaign.id); return { campaign: approved, allowedNextActions: nextActions(approved, access) };
};

export const validateCampaignPackage = (input: CampaignInput, access: DeveloperCockpitAccess) => { const normalized = normalizeCampaignInput(input); if (!normalized.ok) return { normalized: null, blockingErrors: [normalized.message], readinessWarnings: [], allowedNextActions: [] }; const warnings = [normalized.value.productionNote ? '' : 'Add a production note so reviewers understand the release context.', normalized.value.variants.some((variant) => !variant.attachments.length) ? 'One or more channels are text-only.' : '', normalized.value.variants.flatMap((variant) => variant.attachments).some((attachment) => !attachment.altText) ? 'Every attachment needs contextual alt text.' : ''].filter(Boolean); return { normalized: normalized.value, blockingErrors: [], readinessWarnings: warnings, allowedNextActions: access.isOwner ? ['create_draft', 'approve'] : ['create_draft'] }; };

export const updateCampaignAssociations = async ({ access, campaignId, expectedVersion, associations }: { access: DeveloperCockpitAccess; campaignId: string; expectedVersion: unknown; associations: unknown }) => {
  const campaign = await getCampaignRecord(campaignId);
  return saveSocialCampaign({ access, campaignId, expectedVersion, input: {
    title: campaign.title, objective: campaign.objective, destinationUrl: campaign.destinationUrl,
    productionNote: campaign.productionNote, requestedPublishAt: campaign.requestedPublishAt,
    variants: campaign.variants.map((variant) => ({ service: variant.service, text: variant.text, attachments: variant.attachments.map((attachment) => ({ mediaId: attachment.mediaId, derivativeId: attachment.derivativeId, displayOrder: attachment.displayOrder, altText: attachment.altText, captionOverride: attachment.captionOverride, cropIntent: attachment.cropIntent })) })),
    associations,
  } });
};
