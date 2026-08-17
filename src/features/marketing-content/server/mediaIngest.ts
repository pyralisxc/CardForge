import { createHash, randomUUID } from 'node:crypto';

import sharp from 'sharp';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import type { CampaignMedia } from '@/features/marketing-content/model';
import {
  getCampaignMediaForAccess,
  getCampaignMediaRecord,
  SOCIAL_SOURCE_BUCKET,
} from '@/features/marketing-content/server/media';

import {
  DeveloperCockpitStoreError,
  MEDIA_COLUMNS,
  readFirstDatabaseRow,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
  type CampaignMediaRow,
} from './storeShared';

const MIME_TYPE_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

export const processSocialMediaImage = async (
  source: Buffer,
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  originalMimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}> => {
  try {
    const metadata = await sharp(source, { failOn: 'error' }).metadata();
    const originalMimeType = metadata.format
      ? MIME_TYPE_BY_FORMAT[metadata.format as keyof typeof MIME_TYPE_BY_FORMAT]
      : undefined;
    if (!originalMimeType) throw new Error('Unsupported image format');

    const { data, info } = await sharp(source, { failOn: 'error' })
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      width: info.width,
      height: info.height,
      originalMimeType,
    };
  } catch {
    throw new DeveloperCockpitStoreError('Upload a valid campaign image.', 400);
  }
};

const safeFilename = (filename: string) => (
  filename.replace(/[\\/\0]/g, '-').trim().slice(0, 255) || 'campaign-image'
);

const normalizeIdempotencyKey = (value: unknown) => (
  typeof value === 'string' && value.length >= 16 && value.length <= 160
    ? value
    : ''
);

const retainProtectedObject = async (
  bucket: string,
  path: string,
  content: Buffer,
  contentType: string,
) => {
  const { error } = await requireCockpitDatabase().storage
    .from(bucket)
    .upload(path, content, { contentType, upsert: false });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throwCockpitDatabaseError('Unable to retain protected campaign media.', error);
  }
};

type IngestCampaignMediaInput = {
  access: DeveloperCockpitAccess;
  file: File;
  idempotencyKey: unknown;
  rightsBasis?: unknown;
  creatorCredit?: unknown;
  rightsRestriction?: unknown;
  rightsExpiresAt?: unknown;
  reusableCaption?: unknown;
  reusableDescription?: unknown;
  focalPoint?: unknown;
};

const cleanMetadata = (
  value: unknown,
  limit: number,
  label: string,
) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > limit) {
    throw new DeveloperCockpitStoreError(
      `${label} must be ${limit.toLocaleString('en-US')} characters or fewer.`,
      400,
    );
  }
  return text;
};

const parseFocalPoint = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const focal = value && typeof value === 'object'
    ? value as { x?: unknown; y?: unknown }
    : null;
  const x = typeof focal?.x === 'number' && focal.x >= 0 && focal.x <= 1
    ? focal.x
    : null;
  const y = typeof focal?.y === 'number' && focal.y >= 0 && focal.y <= 1
    ? focal.y
    : null;
  if (x === null || y === null) {
    throw new DeveloperCockpitStoreError(
      'Focal points need horizontal and vertical coordinates between 0 and 1.',
      400,
    );
  }
  return { x, y };
};

const parseRightsExpiry = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new DeveloperCockpitStoreError('Rights expiry is invalid.', 400);
  }
  if (parsed.getTime() <= Date.now()) {
    throw new DeveloperCockpitStoreError(
      'Rights expiry must be in the future.',
      400,
    );
  }
  return parsed.toISOString();
};

const retryIngestConflict = async ({
  access,
  key,
  contentHash,
}: {
  access: DeveloperCockpitAccess;
  key: string;
  contentHash: string;
}): Promise<CampaignMedia | null> => {
  const supabase = requireCockpitDatabase();
  const idempotentResult = await supabase
    .from('cardforge_campaign_media')
    .select(MEDIA_COLUMNS)
    .eq('ingesting_contributor_id', access.user.id)
    .eq('ingest_idempotency_key', key)
    .limit(1);
  if (idempotentResult.error) {
    throwCockpitDatabaseError(
      'Unable to recover campaign media ingestion.',
      idempotentResult.error,
    );
  }
  const idempotent = readFirstDatabaseRow<CampaignMediaRow>(idempotentResult.data);
  if (idempotent) return getCampaignMediaForAccess(idempotent, access);

  const duplicateResult = await supabase
    .from('cardforge_campaign_media')
    .select(MEDIA_COLUMNS)
    .eq('content_hash', contentHash)
    .limit(1);
  if (duplicateResult.error) {
    throwCockpitDatabaseError(
      'Unable to recover campaign media duplicate.',
      duplicateResult.error,
    );
  }
  const duplicate = readFirstDatabaseRow<CampaignMediaRow>(duplicateResult.data);
  return duplicate ? getCampaignMediaForAccess(duplicate, access) : null;
};

export const ingestCampaignMedia = async ({
  access,
  file,
  idempotencyKey,
  rightsBasis,
  creatorCredit,
  rightsRestriction,
  rightsExpiresAt,
  reusableCaption,
  reusableDescription,
  focalPoint,
}: IngestCampaignMediaInput): Promise<CampaignMedia> => {
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) {
    throw new DeveloperCockpitStoreError(
      'A client-generated media idempotency key is required.',
      400,
    );
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash('sha256').update(raw).digest('hex');
  const supabase = requireCockpitDatabase();
  const existing = await retryIngestConflict({ access, key, contentHash });
  if (existing) return existing;

  const processed = await processSocialMediaImage(raw);
  const focal = parseFocalPoint(focalPoint);
  const expiry = parseRightsExpiry(rightsExpiresAt);
  const originalPath = `originals/${contentHash}`;
  const normalizedPath = `masters/${contentHash}.webp`;

  await retainProtectedObject(
    SOCIAL_SOURCE_BUCKET,
    originalPath,
    raw,
    processed.originalMimeType,
  );
  await retainProtectedObject(
    SOCIAL_SOURCE_BUCKET,
    normalizedPath,
    processed.buffer,
    'image/webp',
  );

  const { data, error } = await supabase
    .from('cardforge_campaign_media')
    .insert({
      id: randomUUID(),
      ingesting_contributor_id: access.user.id,
      contributor_email: access.email,
      contributor_name: access.displayName,
      ingest_idempotency_key: key,
      media_kind: 'image',
      original_mime_type: processed.originalMimeType,
      original_filename: safeFilename(file.name),
      original_byte_count: file.size,
      width: processed.width,
      height: processed.height,
      content_hash: contentHash,
      original_storage_bucket: SOCIAL_SOURCE_BUCKET,
      original_storage_path: originalPath,
      normalized_storage_bucket: SOCIAL_SOURCE_BUCKET,
      normalized_storage_path: normalizedPath,
      normalized_byte_count: processed.buffer.byteLength,
      normalized_mime_type: 'image/webp',
      rights_basis: cleanMetadata(rightsBasis, 1000, 'Rights basis'),
      creator_credit: cleanMetadata(creatorCredit, 500, 'Creator credit'),
      rights_restriction: cleanMetadata(rightsRestriction, 1000, 'Rights restriction'),
      rights_expires_at: expiry,
      reusable_caption: cleanMetadata(reusableCaption, 1000, 'Reusable caption'),
      reusable_description: cleanMetadata(
        reusableDescription,
        2000,
        'Reusable description',
      ),
      focal_x: focal?.x ?? null,
      focal_y: focal?.y ?? null,
      review_state: 'needs_review',
    })
    .select('id')
    .limit(1);

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      const recovered = await retryIngestConflict({ access, key, contentHash });
      if (recovered) return recovered;
    }
    throwCockpitDatabaseError('Unable to record campaign media.', error);
  }

  const mediaId = readFirstDatabaseRow<{ id: string }>(data)?.id;
  if (!mediaId) {
    throw new DeveloperCockpitStoreError(
      'Campaign media ingestion did not return an identifier.',
    );
  }
  return (await getCampaignMediaRecord(mediaId)).media;
};
