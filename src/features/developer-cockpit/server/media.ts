import { createHash, randomUUID } from 'node:crypto';

import sharp from 'sharp';

import type { CampaignMedia } from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import {
  DERIVATIVE_COLUMNS,
  DeveloperCockpitStoreError,
  getCampaignMediaRows,
  MEDIA_COLUMNS,
  mapMediaRow,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
  type CampaignMediaRow,
  type DerivativeRow,
} from './storeShared';

export const SOCIAL_SOURCE_BUCKET = 'cardforge-social-sources';
export const SOCIAL_PUBLIC_MEDIA_BUCKET = 'cardforge-social-media';
export const MAX_SOCIAL_MEDIA_BYTES = 12 * 1024 * 1024;
export const SOCIAL_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const validateSocialMediaFile = ({ size, type }: { size: number; type: string }) => {
  if (size <= 0 || size > MAX_SOCIAL_MEDIA_BYTES) return { ok: false as const, message: 'Choose a campaign image that is 12 MB or smaller.' };
  if (!SOCIAL_MEDIA_MIME_TYPES.has(type)) return { ok: false as const, message: 'Choose a JPEG, PNG, or WebP campaign image.' };
  return { ok: true as const };
};

export const processSocialMediaImage = async (source: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> => {
  try {
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    await pipeline.metadata();
    const { data, info } = await pipeline.resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch { throw new DeveloperCockpitStoreError('Upload a valid campaign image.', 400); }
};

const safeFilename = (filename: string) => filename.replace(/[\\/\0]/g, '-').trim().slice(0, 255) || 'campaign-image';
const getIdempotencyKey = (value: unknown) => typeof value === 'string' && value.length >= 16 && value.length <= 160 ? value : '';
const isMediaVisible = (row: CampaignMediaRow, access: DeveloperCockpitAccess) => access.isOwner || row.ingesting_contributor_id === access.user.id || ['approved', 'public'].includes(row.review_state);

export const assertMediaAccess = (row: CampaignMediaRow, access: DeveloperCockpitAccess) => {
  if (!isMediaVisible(row, access)) throw new DeveloperCockpitStoreError('Campaign media access denied.', 403);
};

export const getCampaignMediaRecord = async (mediaId: string): Promise<{ media: CampaignMedia; row: CampaignMediaRow; derivatives: DerivativeRow[] }> => {
  const { rows, derivatives, media } = await getCampaignMediaRows([mediaId]);
  const row = rows[0]; const value = media[0];
  if (!row || !value) throw new DeveloperCockpitStoreError('Campaign media not found.', 404);
  return { row, derivatives, media: value };
};

const upsertProtectedObject = async (bucket: string, path: string, content: Buffer, contentType: string) => {
  const supabase = requireCockpitDatabase();
  const { error } = await supabase.storage.from(bucket).upload(path, content, { contentType, upsert: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throwCockpitDatabaseError('Unable to retain protected campaign media.', error);
};

export const ingestCampaignMedia = async ({ access, file, idempotencyKey, rightsBasis, creatorCredit, rightsRestriction, rightsExpiresAt, reusableCaption, reusableDescription, focalPoint }: {
  access: DeveloperCockpitAccess; file: File; idempotencyKey: unknown; rightsBasis?: unknown; creatorCredit?: unknown; rightsRestriction?: unknown; rightsExpiresAt?: unknown; reusableCaption?: unknown; reusableDescription?: unknown; focalPoint?: unknown;
}): Promise<CampaignMedia> => {
  const key = getIdempotencyKey(idempotencyKey);
  if (!key) throw new DeveloperCockpitStoreError('A client-generated media idempotency key is required.', 400);
  const raw = Buffer.from(await file.arrayBuffer()); const hash = createHash('sha256').update(raw).digest('hex');
  const supabase = requireCockpitDatabase();
  const { data: idempotentRows, error: idempotentError } = await supabase.from('cardforge_campaign_media').select(MEDIA_COLUMNS).eq('ingesting_contributor_id', access.user.id).eq('ingest_idempotency_key', key).limit(1);
  if (idempotentError) throwCockpitDatabaseError('Unable to check campaign media ingestion.', idempotentError);
  if (idempotentRows?.[0]) return (await getCampaignMediaRecord((idempotentRows[0] as CampaignMediaRow).id)).media;
  const { data: duplicateRows, error: duplicateError } = await supabase.from('cardforge_campaign_media').select(MEDIA_COLUMNS).eq('content_hash', hash).limit(1);
  if (duplicateError) throwCockpitDatabaseError('Unable to check campaign media duplicate.', duplicateError);
  if (duplicateRows?.[0]) {
    const duplicate = duplicateRows[0] as CampaignMediaRow;
    assertMediaAccess(duplicate, access);
    return (await getCampaignMediaRecord(duplicate.id)).media;
  }
  const processed = await processSocialMediaImage(raw);
  const rights = {
    rightsBasis: typeof rightsBasis === 'string' ? rightsBasis.trim().slice(0, 1000) : '',
    creatorCredit: typeof creatorCredit === 'string' ? creatorCredit.trim().slice(0, 500) : '',
    rightsRestriction: typeof rightsRestriction === 'string' ? rightsRestriction.trim().slice(0, 1000) : '',
    reusableCaption: typeof reusableCaption === 'string' ? reusableCaption.trim().slice(0, 1000) : '',
    reusableDescription: typeof reusableDescription === 'string' ? reusableDescription.trim().slice(0, 2000) : '',
  };
  const expiry = typeof rightsExpiresAt === 'string' && rightsExpiresAt.trim() && Number.isFinite(new Date(rightsExpiresAt).getTime()) ? new Date(rightsExpiresAt).toISOString() : null;
  const focal = focalPoint && typeof focalPoint === 'object' ? focalPoint as { x?: unknown; y?: unknown } : null;
  const focalX = typeof focal?.x === 'number' && focal.x >= 0 && focal.x <= 1 ? focal.x : null;
  const focalY = typeof focal?.y === 'number' && focal.y >= 0 && focal.y <= 1 ? focal.y : null;
  if ((focalX === null) !== (focalY === null)) throw new DeveloperCockpitStoreError('Focal points need both horizontal and vertical coordinates.', 400);
  const originalPath = `originals/${hash}`; const normalizedPath = `masters/${hash}.webp`;
  await upsertProtectedObject(SOCIAL_SOURCE_BUCKET, originalPath, raw, file.type);
  await upsertProtectedObject(SOCIAL_SOURCE_BUCKET, normalizedPath, processed.buffer, 'image/webp');
  const { data, error } = await supabase.from('cardforge_campaign_media').insert({ id: randomUUID(), ingesting_contributor_id: access.user.id, contributor_email: access.email, contributor_name: access.displayName, ingest_idempotency_key: key, media_kind: 'image', original_mime_type: file.type, original_filename: safeFilename(file.name), original_byte_count: file.size, width: processed.width, height: processed.height, content_hash: hash, original_storage_bucket: SOCIAL_SOURCE_BUCKET, original_storage_path: originalPath, normalized_storage_bucket: SOCIAL_SOURCE_BUCKET, normalized_storage_path: normalizedPath, normalized_byte_count: processed.buffer.byteLength, normalized_mime_type: 'image/webp', rights_basis: rights.rightsBasis, creator_credit: rights.creatorCredit, rights_restriction: rights.rightsRestriction, rights_expires_at: expiry, reusable_caption: rights.reusableCaption, reusable_description: rights.reusableDescription, focal_x: focalX, focal_y: focalY, review_state: 'needs_review' }).select('id').limit(1);
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      const { data: retryRows } = await supabase.from('cardforge_campaign_media').select('id').eq('content_hash', hash).limit(1);
      if (retryRows?.[0]?.id) return (await getCampaignMediaRecord(retryRows[0].id as string)).media;
    }
    throwCockpitDatabaseError('Unable to record campaign media.', error);
  }
  const mediaId = data?.[0]?.id as string | undefined;
  if (!mediaId) throw new DeveloperCockpitStoreError('Campaign media ingestion did not return an identifier.');
  return (await getCampaignMediaRecord(mediaId)).media;
};

export const getAuthorizedCampaignMedia = async (access: DeveloperCockpitAccess, filters: { query?: string; state?: string; campaignId?: string } = {}): Promise<CampaignMedia[]> => {
  const supabase = requireCockpitDatabase();
  let query = supabase.from('cardforge_campaign_media').select(MEDIA_COLUMNS).order('created_at', { ascending: false }).limit(200);
  if (!access.isOwner) query = query.or(`ingesting_contributor_id.eq.${access.user.id},review_state.in.(approved,public)`);
  if (filters.state && ['private', 'needs_review', 'approved', 'public', 'archived'].includes(filters.state)) query = query.eq('review_state', filters.state);
  if (filters.query) query = query.or(`original_filename.ilike.%${filters.query.replace(/[,%()]/g, '')}%,creator_credit.ilike.%${filters.query.replace(/[,%()]/g, '')}%,reusable_caption.ilike.%${filters.query.replace(/[,%()]/g, '')}%`);
  const { data, error } = await query;
  if (error) throwCockpitDatabaseError('Unable to load campaign media library.', error);
  let rows = (data ?? []) as CampaignMediaRow[];
  if (filters.campaignId) {
    const { data: linked, error: linkedError } = await supabase.from('cardforge_social_campaign_media_attachments').select('media_id').eq('campaign_id', filters.campaignId);
    if (linkedError) throwCockpitDatabaseError('Unable to filter campaign media.', linkedError);
    const ids = new Set((linked ?? []).map((row) => row.media_id as string)); rows = rows.filter((row) => ids.has(row.id));
  }
  const mediaIds = rows.map((row) => row.id); const { data: rawDerivatives, error: derivativeError } = mediaIds.length ? await supabase.from('cardforge_campaign_media_derivatives').select(DERIVATIVE_COLUMNS).in('parent_media_id', mediaIds) : { data: [], error: null };
  if (derivativeError) throwCockpitDatabaseError('Unable to load campaign-media derivatives.', derivativeError);
  const { data: rawAttachments, error: attachmentError } = mediaIds.length ? await supabase.from('cardforge_social_campaign_media_attachments').select('media_id,campaign_id').in('media_id', mediaIds) : { data: [], error: null };
  if (attachmentError) throwCockpitDatabaseError('Unable to load campaign-media relationships.', attachmentError);
  const { data: jobs } = await supabase.from('cardforge_social_publish_jobs').select('campaign_id').limit(500);
  return rows.map((row) => { const campaignIds = [...new Set((rawAttachments ?? []).filter((attachment) => attachment.media_id === row.id).map((attachment) => attachment.campaign_id as string))]; return mapMediaRow(row, ((rawDerivatives ?? []) as DerivativeRow[]).filter((derivative) => derivative.parent_media_id === row.id), campaignIds, (jobs ?? []).filter((job) => campaignIds.includes(job.campaign_id as string)).length); });
};

export const getPublicCampaignMediaUrl = async (mediaId: string, derivativeId: string | null): Promise<string> => {
  const { derivatives } = await getCampaignMediaRecord(mediaId);
  const derivative = derivativeId
    ? derivatives.find((item) => item.id === derivativeId)
    : derivatives.find((item) => item.purpose === 'public_original' && item.exposure === 'public');
  if (!derivative || derivative.exposure !== 'public') {
    throw new DeveloperCockpitStoreError('Approved public media is required before provider delivery.', 409);
  }
  return requireCockpitDatabase().storage.from(derivative.storage_bucket).getPublicUrl(derivative.storage_path).data.publicUrl;
};
