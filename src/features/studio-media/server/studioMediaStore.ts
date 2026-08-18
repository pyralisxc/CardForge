import { createHash, randomUUID } from 'node:crypto';

import { STUDIO_MEDIA_KINDS, type StudioMedia, type StudioMediaCreationSource, type StudioMediaKind } from '@/features/studio-media/model';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

import { StudioMediaError } from './StudioMediaError';
import { processStudioMediaImage, validateStudioMediaSource } from './studioMediaImage';

export const STUDIO_MEDIA_STORAGE_BUCKET = 'cardforge-studio-media';

interface StudioMediaRow {
  id: string;
  owner_user_id: string;
  name: string;
  media_kind: StudioMediaKind;
  creation_source: StudioMediaCreationSource;
  original_filename: string;
  original_mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  original_byte_count: number;
  normalized_mime_type: 'image/webp';
  normalized_byte_count: number;
  width: number;
  height: number;
  content_hash: string;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

const MEDIA_COLUMNS = [
  'id',
  'owner_user_id',
  'name',
  'media_kind',
  'creation_source',
  'original_filename',
  'original_mime_type',
  'original_byte_count',
  'normalized_mime_type',
  'normalized_byte_count',
  'width',
  'height',
  'content_hash',
  'storage_bucket',
  'storage_path',
  'created_at',
  'updated_at',
].join(',');

const requireStudioMediaDatabase = () => {
  const client = getSupabaseServerClient();
  if (!client) throw new StudioMediaError('Personal Studio media storage is not configured.', 503);
  return client;
};

const isStudioMediaKind = (value: unknown): value is StudioMediaKind => (
  typeof value === 'string' && (STUDIO_MEDIA_KINDS as readonly string[]).includes(value)
);

const cleanName = (value: string): string => {
  const name = value.trim().replace(/\s+/g, ' ').slice(0, 160);
  if (!name) throw new StudioMediaError('Studio artwork needs a name.', 400);
  return name;
};

const cleanFilename = (value: string): string => (
  value.replace(/[\\/\0]/g, '-').trim().slice(0, 255)
);

const safeOwnerPath = (ownerUserId: string): string => (
  ownerUserId.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 255) || 'account'
);

const mapStudioMediaRow = (row: StudioMediaRow): StudioMedia => ({
  id: row.id,
  name: row.name,
  kind: row.media_kind,
  creationSource: row.creation_source,
  originalFilename: row.original_filename,
  originalMimeType: row.original_mime_type,
  originalByteCount: Number(row.original_byte_count),
  normalizedMimeType: row.normalized_mime_type,
  normalizedByteCount: Number(row.normalized_byte_count),
  width: Number(row.width),
  height: Number(row.height),
  contentHash: row.content_hash,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const firstRow = <T>(value: unknown): T | null => (
  Array.isArray(value) && value.length > 0 ? value[0] as T : null
);

const getExistingMedia = async ({
  ownerUserId,
  kind,
  contentHash,
}: {
  ownerUserId: string;
  kind: StudioMediaKind;
  contentHash: string;
}): Promise<StudioMediaRow | null> => {
  const { data, error } = await requireStudioMediaDatabase()
    .from('cardforge_studio_media')
    .select(MEDIA_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .eq('media_kind', kind)
    .eq('content_hash', contentHash)
    .limit(1);
  if (error) throw new StudioMediaError('Unable to check personal Studio media.', 503);
  return firstRow<StudioMediaRow>(data);
};

export const listStudioMedia = async (ownerUserId: string): Promise<StudioMedia[]> => {
  const { data, error } = await requireStudioMediaDatabase()
    .from('cardforge_studio_media')
    .select(MEDIA_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(250);
  if (error) throw new StudioMediaError('Unable to load personal Studio media.', 503);
  return (Array.isArray(data) ? data as StudioMediaRow[] : []).map(mapStudioMediaRow);
};

export const getStudioMedia = async (
  ownerUserId: string,
  mediaId: string,
): Promise<{ media: StudioMedia; row: StudioMediaRow }> => {
  const { data, error } = await requireStudioMediaDatabase()
    .from('cardforge_studio_media')
    .select(MEDIA_COLUMNS)
    .eq('id', mediaId)
    .eq('owner_user_id', ownerUserId)
    .limit(1);
  if (error) throw new StudioMediaError('Unable to load personal Studio media.', 503);
  const row = firstRow<StudioMediaRow>(data);
  if (!row) throw new StudioMediaError('Personal Studio media not found.', 404);
  return { media: mapStudioMediaRow(row), row };
};

export interface CreateStudioMediaInput {
  ownerUserId: string;
  name: string;
  kind: StudioMediaKind | string;
  creationSource: StudioMediaCreationSource;
  originalFilename?: string;
  declaredMimeType?: string;
  bytes: Buffer;
}

export const createStudioMedia = async ({
  ownerUserId,
  name,
  kind: kindValue,
  creationSource,
  originalFilename = '',
  declaredMimeType,
  bytes,
}: CreateStudioMediaInput): Promise<StudioMedia> => {
  if (!isStudioMediaKind(kindValue)) throw new StudioMediaError('Choose a supported Studio media kind.', 400);
  validateStudioMediaSource({ byteCount: bytes.byteLength, declaredMimeType });
  const processed = await processStudioMediaImage(bytes);
  const contentHash = createHash('sha256').update(processed.buffer).digest('hex');
  const existing = await getExistingMedia({
    ownerUserId,
    kind: kindValue,
    contentHash,
  });
  if (existing) return mapStudioMediaRow(existing);

  const mediaId = randomUUID();
  const storagePath = `${safeOwnerPath(ownerUserId)}/${mediaId}.webp`;
  const supabase = requireStudioMediaDatabase();
  const storage = supabase.storage.from(STUDIO_MEDIA_STORAGE_BUCKET);
  const { error: uploadError } = await storage.upload(storagePath, processed.buffer, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (uploadError) throw new StudioMediaError('Unable to retain personal Studio media.', 503);

  const { data, error } = await supabase
    .from('cardforge_studio_media')
    .insert({
      id: mediaId,
      owner_user_id: ownerUserId,
      name: cleanName(name),
      media_kind: kindValue,
      creation_source: creationSource,
      original_filename: cleanFilename(originalFilename),
      original_mime_type: processed.originalMimeType,
      original_byte_count: bytes.byteLength,
      normalized_mime_type: 'image/webp',
      normalized_byte_count: processed.buffer.byteLength,
      width: processed.width,
      height: processed.height,
      content_hash: contentHash,
      storage_bucket: STUDIO_MEDIA_STORAGE_BUCKET,
      storage_path: storagePath,
    })
    .select(MEDIA_COLUMNS)
    .limit(1);

  if (error) {
    const { error: cleanupError } = await storage.remove([storagePath]);
    if (cleanupError) console.error('Failed to compensate Studio media upload:', cleanupError);
    if (/duplicate key|unique/i.test(error.message)) {
      const recovered = await getExistingMedia({ ownerUserId, kind: kindValue, contentHash });
      if (recovered) return mapStudioMediaRow(recovered);
    }
    throw new StudioMediaError('Unable to record personal Studio media.', 503);
  }

  const row = firstRow<StudioMediaRow>(data);
  if (!row) {
    const { error: cleanupError } = await storage.remove([storagePath]);
    if (cleanupError) console.error('Failed to compensate incomplete Studio media upload:', cleanupError);
    throw new StudioMediaError('Studio media upload did not return an identifier.', 500);
  }
  return mapStudioMediaRow(row);
};

export const downloadStudioMedia = async (
  ownerUserId: string,
  mediaId: string,
): Promise<{ media: StudioMedia; bytes: ArrayBuffer }> => {
  const { media, row } = await getStudioMedia(ownerUserId, mediaId);
  if (row.storage_bucket !== STUDIO_MEDIA_STORAGE_BUCKET) {
    throw new StudioMediaError('Studio media storage metadata is invalid.', 500);
  }
  const { data, error } = await requireStudioMediaDatabase()
    .storage
    .from(row.storage_bucket)
    .download(row.storage_path);
  if (error || !data) throw new StudioMediaError('Unable to read personal Studio media.', 503);
  return { media, bytes: await data.arrayBuffer() };
};
