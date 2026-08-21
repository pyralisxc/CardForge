import { createHash } from 'node:crypto';

import type { ProjectDocumentV1 } from '@/features/project/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  collectStudioDocumentAssetIds,
  getStudioDocumentAssetReference,
  MAX_STUDIO_DOCUMENT_ASSETS,
  MAX_STUDIO_DOCUMENT_ASSET_STORAGE_BYTES,
  STUDIO_DOCUMENT_ASSET_BUCKET,
  type StudioDocumentAssetDownload,
} from '../assetReferences';
import { normalizeEmbeddedTemplateAsset, type EmbeddedTemplateAssetMimeType } from './embeddedTemplateAssets';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';

const DATA_IMAGE_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/u;

const requireStore = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new StudioDocumentStoreError('Studio document asset storage is not configured yet.', 503);
  return supabase;
};

const storagePrefix = (ownerUserId: string, documentId: string) => `${ownerUserId}/${documentId}`;
const storagePath = (ownerUserId: string, documentId: string, assetId: string) => (
  `${storagePrefix(ownerUserId, documentId)}/${assetId}.webp`
);

const readObjectSize = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const size = Number((metadata as { size?: unknown }).size);
  return Number.isFinite(size) && size >= 0 ? size : null;
};

export const externalizeStudioDocumentAssets = async ({
  ownerUserId,
  documentId,
  document,
}: {
  ownerUserId: string;
  documentId: string;
  document: ProjectDocumentV1;
}): Promise<{ document: ProjectDocumentV1; uploadedAssetIds: string[] }> => {
  const pendingBySource = new Map<string, Promise<{ id: string; bytes: Buffer } | null>>();
  const assets = new Map<string, Buffer>();

  const prepare = (value: string) => {
    const match = DATA_IMAGE_PATTERN.exec(value);
    if (!match) return null;
    let pending = pendingBySource.get(value);
    if (!pending) {
      pending = normalizeEmbeddedTemplateAsset({
        mimeType: match[1] as EmbeddedTemplateAssetMimeType,
        data: match[2],
      }).then((normalized) => ({
        id: createHash('sha256').update(normalized.bytes).digest('hex'),
        bytes: normalized.bytes,
      }));
      pendingBySource.set(value, pending);
    }
    return pending;
  };

  const visit = async (value: unknown): Promise<unknown> => {
    if (typeof value === 'string') {
      const prepared = await prepare(value);
      if (!prepared) return value;
      assets.set(prepared.id, prepared.bytes);
      if (assets.size > MAX_STUDIO_DOCUMENT_ASSETS) {
        throw new StudioDocumentStoreError(`A Studio document can contain at most ${MAX_STUDIO_DOCUMENT_ASSETS} private artwork files.`, 413);
      }
      return getStudioDocumentAssetReference(prepared.id);
    }
    if (Array.isArray(value)) {
      const entries: unknown[] = [];
      for (const entry of value) entries.push(await visit(entry));
      return entries;
    }
    if (value && typeof value === 'object') {
      const entries: Array<readonly [string, unknown]> = [];
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        entries.push([key, await visit(entry)] as const);
      }
      return Object.fromEntries(entries);
    }
    return value;
  };

  const storedDocument = await visit(document) as ProjectDocumentV1;
  const referencedIds = collectStudioDocumentAssetIds(storedDocument);
  if (referencedIds.length > MAX_STUDIO_DOCUMENT_ASSETS) {
    throw new StudioDocumentStoreError(`A Studio document can contain at most ${MAX_STUDIO_DOCUMENT_ASSETS} private artwork files.`, 413);
  }
  const existingSizes = new Map<string, number>();
  const existingIds = new Set<string>();
  if (referencedIds.length > 0) {
    const { data, error } = await requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).list(
      storagePrefix(ownerUserId, documentId),
      { limit: MAX_STUDIO_DOCUMENT_ASSETS },
    );
    if (error) throw new StudioDocumentStoreError('Unable to inspect private Studio artwork capacity.');
    (data ?? []).forEach((item) => {
      const id = item.name.endsWith('.webp') ? item.name.slice(0, -5) : '';
      const size = readObjectSize(item);
      if (id) existingIds.add(id);
      if (size !== null) existingSizes.set(id, size);
    });
  }
  const totalBytes = referencedIds.reduce((total, id) => (
    total + (assets.get(id)?.byteLength ?? existingSizes.get(id) ?? 0)
  ), 0);
  if (totalBytes > MAX_STUDIO_DOCUMENT_ASSET_STORAGE_BYTES) {
    throw new StudioDocumentStoreError('This Studio document contains more than 128 MB of private artwork.', 413);
  }

  const uploadedAssetIds: string[] = [];
  try {
    for (const [assetId, bytes] of assets) {
      if (existingIds.has(assetId)) continue;
      const { error } = await requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).upload(
        storagePath(ownerUserId, documentId, assetId),
        bytes,
        { contentType: 'image/webp', cacheControl: '3600', upsert: false },
      );
      if (error) throw new StudioDocumentStoreError('Unable to store private Studio artwork.');
      uploadedAssetIds.push(assetId);
    }
  } catch (error) {
    await cleanupUploadedStudioDocumentAssets({ ownerUserId, documentId, uploadedAssetIds });
    throw error;
  }
  return { document: storedDocument, uploadedAssetIds };
};

export const cleanupUploadedStudioDocumentAssets = async ({
  ownerUserId,
  documentId,
  uploadedAssetIds,
}: {
  ownerUserId: string;
  documentId: string;
  uploadedAssetIds: string[];
}): Promise<void> => {
  if (uploadedAssetIds.length === 0) return;
  const store = requireStore();
  const { data, error } = await store
    .from('cardforge_studio_documents')
    .select('document_payload')
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) {
    console.error('Unable to reconcile failed Studio artwork upload:', error);
    return;
  }
  const referenced = new Set(collectStudioDocumentAssetIds(data?.document_payload));
  const stalePaths = uploadedAssetIds
    .filter((id) => !referenced.has(id))
    .map((id) => storagePath(ownerUserId, documentId, id));
  if (stalePaths.length === 0) return;
  const removed = await store.storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).remove(stalePaths);
  if (removed.error) console.error('Unable to roll back failed Studio artwork upload:', removed.error);
};

export const getStudioDocumentAssetDownloads = async ({
  ownerUserId,
  documentId,
  value,
}: {
  ownerUserId: string;
  documentId: string;
  value: unknown;
}): Promise<StudioDocumentAssetDownload[]> => {
  const ids = collectStudioDocumentAssetIds(value);
  if (ids.length === 0) return [];
  const paths = ids.map((id) => storagePath(ownerUserId, documentId, id));
  const { data, error } = await requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).createSignedUrls(paths, 15 * 60);
  if (error) throw new StudioDocumentStoreError('Unable to authorize private Studio artwork downloads.');
  const signedByPath = new Map((data ?? []).map((item) => [item.path, item.signedUrl]));
  return ids.map((id) => {
    const signedUrl = signedByPath.get(storagePath(ownerUserId, documentId, id));
    if (!signedUrl) throw new StudioDocumentStoreError('One of this document’s private artwork files is unavailable.');
    return { id, mimeType: 'image/webp', size: null, signedUrl };
  });
};

export const removeStudioDocumentAssets = async (ownerUserId: string, documentId: string): Promise<void> => {
  const prefix = storagePrefix(ownerUserId, documentId);
  const { data, error } = await requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).list(prefix, { limit: MAX_STUDIO_DOCUMENT_ASSETS });
  if (error) throw new StudioDocumentStoreError('Unable to inspect private Studio artwork for removal.');
  const paths = (data ?? []).map((item) => `${prefix}/${item.name}`);
  if (paths.length === 0) return;
  const removed = await requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).remove(paths);
  if (removed.error) throw new StudioDocumentStoreError('Unable to remove private Studio artwork.');
};

export const removeUnreferencedStudioDocumentAssets = async ({
  ownerUserId,
  documentId,
  document,
}: {
  ownerUserId: string;
  documentId: string;
  document: ProjectDocumentV1;
}): Promise<void> => {
  const keep = new Set(collectStudioDocumentAssetIds(document).map((id) => `${id}.webp`));
  const prefix = storagePrefix(ownerUserId, documentId);
  const { data, error } = await requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).list(prefix, { limit: MAX_STUDIO_DOCUMENT_ASSETS });
  if (error) return;
  const stale = (data ?? []).filter((item) => !keep.has(item.name)).map((item) => `${prefix}/${item.name}`);
  if (stale.length === 0) return;
  const removed = await requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).remove(stale);
  if (removed.error) console.error('Unable to clean stale Studio document artwork:', removed.error);
};
