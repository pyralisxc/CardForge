import { createHash } from 'node:crypto';

import sharp from 'sharp';

import type { TCGCardTemplate } from '@/domain/templates';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

import { PipelineRegistryCommandError } from './pipelineRegistryCommandsError';
import { PIPELINE_STORAGE_BUCKET } from './pipelineUploadPolicy';

export const PIPELINE_TEMPLATE_ASSET_REFERENCE_PREFIX = 'cardforge-pipeline-asset://';
const PIPELINE_TEMPLATE_ASSET_PATH_PREFIX = 'template-assets';
const DATA_IMAGE_PREFIX = 'data:image/';
const TRANSPARENT_PREVIEW_SENTINEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const MAX_SOURCE_BYTES = 2_400_000;
const MAX_SOURCE_DIMENSION = 8192;
const NORMALIZED_MAX_DIMENSION = 2400;
const MAX_TRAVERSAL_DEPTH = 80;
const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/u;

type PipelineTemplateAssetRecord = {
  asset_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: 'image/webp';
  byte_count: number;
};

const requireSupabase = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new PipelineRegistryCommandError('Pipeline Template media storage is not configured yet.', 503);
  }
  return supabase;
};

const parseImageDataUri = (value: string): Buffer | null => {
  if (!value.startsWith(DATA_IMAGE_PREFIX)) return null;
  if (value === TRANSPARENT_PREVIEW_SENTINEL) return Buffer.alloc(0);
  const commaIndex = value.indexOf(',');
  if (commaIndex < 0) return null;
  const metadata = value.slice(5, commaIndex).split(';');
  const mimeType = metadata[0]?.toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(mimeType ?? '')) {
    throw new PipelineRegistryCommandError('Pipeline Template artwork must be PNG, JPEG, WebP, or SVG.', 400);
  }
  try {
    const payload = value.slice(commaIndex + 1);
    const bytes = metadata.some((entry) => entry.toLowerCase() === 'base64')
      ? Buffer.from(payload.replace(/\s+/gu, ''), 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
    if (bytes.length <= 0 || bytes.length > MAX_SOURCE_BYTES) {
      throw new PipelineRegistryCommandError('Pipeline Template artwork must be 2.4 MB or smaller before normalization.', 413);
    }
    return bytes;
  } catch (error) {
    if (error instanceof PipelineRegistryCommandError) throw error;
    throw new PipelineRegistryCommandError('Pipeline Template artwork contains an invalid data URI.', 400);
  }
};

const normalizeImage = async (source: Buffer): Promise<Buffer> => {
  try {
    const metadata = await sharp(source, { failOn: 'error', animated: false }).metadata();
    if (!metadata.width || !metadata.height) throw new Error('Missing image dimensions');
    if (metadata.width > MAX_SOURCE_DIMENSION || metadata.height > MAX_SOURCE_DIMENSION) {
      throw new PipelineRegistryCommandError(
        `Pipeline Template artwork dimensions must be ${MAX_SOURCE_DIMENSION}px or smaller.`,
        400,
      );
    }
    return await sharp(source, { failOn: 'error', animated: false })
      .rotate()
      .resize({
        width: NORMALIZED_MAX_DIMENSION,
        height: NORMALIZED_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer();
  } catch (error) {
    if (error instanceof PipelineRegistryCommandError) throw error;
    throw new PipelineRegistryCommandError('Pipeline Template artwork could not be decoded safely.', 400);
  }
};

const getAssetReference = (assetId: string): string => `${PIPELINE_TEMPLATE_ASSET_REFERENCE_PREFIX}${assetId}`;

const getAssetId = (value: string): string | null => {
  if (!value.startsWith(PIPELINE_TEMPLATE_ASSET_REFERENCE_PREFIX)) return null;
  const assetId = value.slice(PIPELINE_TEMPLATE_ASSET_REFERENCE_PREFIX.length);
  return ASSET_ID_PATTERN.test(assetId) ? assetId : null;
};

const getAssetPath = (assetId: string): string => `${PIPELINE_TEMPLATE_ASSET_PATH_PREFIX}/${assetId}.webp`;

const storeNormalizedAsset = async (bytes: Buffer): Promise<string> => {
  const supabase = requireSupabase();
  const assetId = createHash('sha256').update(bytes).digest('hex');
  const storagePath = getAssetPath(assetId);
  const storage = supabase.storage.from(PIPELINE_STORAGE_BUCKET);
  const existing = await storage.exists(storagePath);
  if (existing.error && existing.data !== false) {
    throw new PipelineRegistryCommandError('Unable to inspect Pipeline Template media storage.', 503);
  }
  if (!existing.data) {
    const uploaded = await storage.upload(storagePath, bytes, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploaded.error) {
      const raced = await storage.exists(storagePath);
      if (!raced.data) {
        throw new PipelineRegistryCommandError('Unable to store Pipeline Template artwork.', 503);
      }
    }
  }
  const record: PipelineTemplateAssetRecord = {
    asset_id: assetId,
    storage_bucket: PIPELINE_STORAGE_BUCKET,
    storage_path: storagePath,
    mime_type: 'image/webp',
    byte_count: bytes.byteLength,
  };
  const { error } = await supabase
    .from('cardforge_pipeline_template_assets')
    .upsert(record, { onConflict: 'asset_id' });
  if (error) {
    throw new PipelineRegistryCommandError('Unable to record Pipeline Template artwork ownership.', 503);
  }
  return getAssetReference(assetId);
};

export const storePipelineTemplateAsset = async (source: Buffer): Promise<string> => (
  storeNormalizedAsset(await normalizeImage(source))
);

const visit = async (
  value: unknown,
  transform: (value: string) => Promise<string>,
  depth = 0,
): Promise<unknown> => {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    throw new PipelineRegistryCommandError('Pipeline Template artwork is nested too deeply.', 400);
  }
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return Promise.all(value.map((entry) => visit(entry, transform, depth + 1)));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([key, entry]) => (
      [key, await visit(entry, transform, depth + 1)] as const
    )));
    return Object.fromEntries(entries);
  }
  return value;
};

export const externalizePipelineTemplateAssets = async <Template extends TCGCardTemplate>(
  template: Template,
): Promise<Template> => {
  const pending = new Map<string, Promise<string>>();
  return await visit(template, async (value) => {
    const source = parseImageDataUri(value);
    if (source === null) return value;
    if (source.length === 0) return '';
    let reference = pending.get(value);
    if (!reference) {
      reference = storePipelineTemplateAsset(source);
      pending.set(value, reference);
    }
    return reference;
  }) as Template;
};

export const hydratePipelineTemplateAssetReferences = <Value>(value: Value): Value => {
  let serialized = '';
  try {
    serialized = JSON.stringify(value);
  } catch {
    return value;
  }
  if (!serialized.includes(PIPELINE_TEMPLATE_ASSET_REFERENCE_PREFIX)) return value;
  const supabase = requireSupabase();
  const storage = supabase.storage.from(PIPELINE_STORAGE_BUCKET);
  const replace = (entry: unknown, depth = 0): unknown => {
    if (depth > MAX_TRAVERSAL_DEPTH) return entry;
    if (typeof entry === 'string') {
      const assetId = getAssetId(entry);
      if (!assetId) return entry;
      return storage.getPublicUrl(getAssetPath(assetId)).data.publicUrl;
    }
    if (Array.isArray(entry)) return entry.map((item) => replace(item, depth + 1));
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(Object.entries(entry as Record<string, unknown>).map(([key, item]) => (
        [key, replace(item, depth + 1)]
      )));
    }
    return entry;
  };
  return replace(value) as Value;
};
