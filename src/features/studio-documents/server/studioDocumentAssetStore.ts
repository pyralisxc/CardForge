import { createHash } from 'node:crypto';

import {
  isProjectFontMimeType,
  MAX_PROJECT_FONT_BYTES,
  type ProjectDocumentV1,
  type ProjectFontMimeType,
} from '@/features/project/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  collectStudioDocumentAssetIds,
  collectStudioDocumentFontIds,
  getStudioDocumentAssetReference,
  getStudioDocumentFontIdFromReference,
  getStudioDocumentFontReference,
  MAX_STUDIO_DOCUMENT_ASSETS,
  MAX_STUDIO_DOCUMENT_ASSET_STORAGE_BYTES,
  MAX_STUDIO_DOCUMENT_FONTS,
  STUDIO_DOCUMENT_ASSET_BUCKET,
  STUDIO_DOCUMENT_FONT_BUCKET,
  type StudioDocumentAssetDownload,
} from '../assetReferences';
import { normalizeEmbeddedTemplateAsset, type EmbeddedTemplateAssetMimeType } from './embeddedTemplateAssets';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';

const DATA_IMAGE_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/u;
const DATA_FONT_PATTERN = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/u;

const requireStore = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new StudioDocumentStoreError('Studio document asset storage is not configured yet.', 503);
  return supabase;
};

const storagePrefix = (ownerUserId: string, documentId: string) => `${ownerUserId}/${documentId}`;
const imageStoragePath = (ownerUserId: string, documentId: string, assetId: string) => (
  `${storagePrefix(ownerUserId, documentId)}/${assetId}.webp`
);
const fontStoragePath = (ownerUserId: string, documentId: string, assetId: string) => (
  `${storagePrefix(ownerUserId, documentId)}/${assetId}`
);

const readObjectSize = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const size = Number((metadata as { size?: unknown }).size);
  return Number.isFinite(size) && size >= 0 ? size : null;
};

const readObjectMimeType = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const mimeType = (metadata as { mimetype?: unknown }).mimetype;
  return typeof mimeType === 'string' && mimeType.trim() ? mimeType.toLowerCase() : null;
};

const decodeFontDataUri = (value: string): { mimeType: ProjectFontMimeType; bytes: Buffer } | null => {
  const match = DATA_FONT_PATTERN.exec(value);
  if (!match) return null;
  const mimeType = match[1]?.toLowerCase() ?? '';
  if (!isProjectFontMimeType(mimeType)) return null;
  const bytes = Buffer.from((match[2] ?? '').replace(/\s+/gu, ''), 'base64');
  if (bytes.length <= 0 || bytes.length > MAX_PROJECT_FONT_BYTES) {
    throw new StudioDocumentStoreError(`A private Studio font must be ${Math.round(MAX_PROJECT_FONT_BYTES / 1024 / 1024)} MB or smaller.`, 413);
  }
  return { mimeType, bytes };
};

export const externalizeStudioDocumentAssets = async ({
  ownerUserId,
  documentId,
  document,
}: {
  ownerUserId: string;
  documentId: string;
  document: ProjectDocumentV1;
}): Promise<{ document: ProjectDocumentV1; uploadedAssetIds: string[]; uploadedFontIds: string[] }> => {
  const pendingImages = new Map<string, Promise<{ id: string; bytes: Buffer } | null>>();
  const pendingFonts = new Map<string, { id: string; bytes: Buffer; mimeType: ProjectFontMimeType }>();
  const images = new Map<string, Buffer>();
  const fonts = new Map<string, { bytes: Buffer; mimeType: ProjectFontMimeType }>();

  const prepareImage = (value: string) => {
    const match = DATA_IMAGE_PATTERN.exec(value);
    if (!match) return null;
    let pending = pendingImages.get(value);
    if (!pending) {
      pending = normalizeEmbeddedTemplateAsset({
        mimeType: match[1] as EmbeddedTemplateAssetMimeType,
        data: match[2],
      }).then((normalized) => ({
        id: createHash('sha256').update(normalized.bytes).digest('hex'),
        bytes: normalized.bytes,
      }));
      pendingImages.set(value, pending);
    }
    return pending;
  };

  const prepareFont = (value: string) => {
    const cached = pendingFonts.get(value);
    if (cached) return cached;
    const decoded = decodeFontDataUri(value);
    if (!decoded) return null;
    const prepared = {
      id: createHash('sha256').update(decoded.bytes).digest('hex'),
      bytes: decoded.bytes,
      mimeType: decoded.mimeType,
    };
    pendingFonts.set(value, prepared);
    return prepared;
  };

  const visit = async (value: unknown): Promise<unknown> => {
    if (typeof value === 'string') {
      const preparedImage = await prepareImage(value);
      if (preparedImage) {
        images.set(preparedImage.id, preparedImage.bytes);
        if (images.size > MAX_STUDIO_DOCUMENT_ASSETS) {
          throw new StudioDocumentStoreError(`A Studio document can contain at most ${MAX_STUDIO_DOCUMENT_ASSETS} private artwork files.`, 413);
        }
        return getStudioDocumentAssetReference(preparedImage.id);
      }
      const preparedFont = prepareFont(value);
      if (preparedFont) {
        fonts.set(preparedFont.id, { bytes: preparedFont.bytes, mimeType: preparedFont.mimeType });
        if (fonts.size > MAX_STUDIO_DOCUMENT_FONTS) {
          throw new StudioDocumentStoreError(`A Studio document can contain at most ${MAX_STUDIO_DOCUMENT_FONTS} private fonts.`, 413);
        }
        return getStudioDocumentFontReference(preparedFont.id);
      }
      return value;
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
  const referencedImageIds = collectStudioDocumentAssetIds(storedDocument);
  const referencedFontIds = collectStudioDocumentFontIds(storedDocument);
  if (referencedImageIds.length > MAX_STUDIO_DOCUMENT_ASSETS) {
    throw new StudioDocumentStoreError(`A Studio document can contain at most ${MAX_STUDIO_DOCUMENT_ASSETS} private artwork files.`, 413);
  }
  if (referencedFontIds.length > MAX_STUDIO_DOCUMENT_FONTS) {
    throw new StudioDocumentStoreError(`A Studio document can contain at most ${MAX_STUDIO_DOCUMENT_FONTS} private fonts.`, 413);
  }

  const prefix = storagePrefix(ownerUserId, documentId);
  const [existingImageList, existingFontList] = await Promise.all([
    requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).list(prefix, { limit: MAX_STUDIO_DOCUMENT_ASSETS }),
    requireStore().storage.from(STUDIO_DOCUMENT_FONT_BUCKET).list(prefix, { limit: MAX_STUDIO_DOCUMENT_FONTS }),
  ]);
  if (existingImageList.error || existingFontList.error) {
    throw new StudioDocumentStoreError('Unable to inspect private Studio asset capacity.');
  }
  const imageSizes = new Map<string, number>();
  const existingImageIds = new Set<string>();
  (existingImageList.data ?? []).forEach((item) => {
    const id = item.name.endsWith('.webp') ? item.name.slice(0, -5) : '';
    const size = readObjectSize(item);
    if (id) existingImageIds.add(id);
    if (id && size !== null) imageSizes.set(id, size);
  });
  const fontSizes = new Map<string, number>();
  const existingFontIds = new Set<string>();
  (existingFontList.data ?? []).forEach((item) => {
    const id = item.name;
    const size = readObjectSize(item);
    if (id) existingFontIds.add(id);
    if (id && size !== null) fontSizes.set(id, size);
  });

  const totalBytes = referencedImageIds.reduce((total, id) => (
    total + (images.get(id)?.byteLength ?? imageSizes.get(id) ?? 0)
  ), 0) + referencedFontIds.reduce((total, id) => (
    total + (fonts.get(id)?.bytes.byteLength ?? fontSizes.get(id) ?? 0)
  ), 0);
  if (totalBytes > MAX_STUDIO_DOCUMENT_ASSET_STORAGE_BYTES) {
    throw new StudioDocumentStoreError('This Studio document contains more than 128 MB of private artwork and fonts.', 413);
  }

  const uploadedAssetIds: string[] = [];
  const uploadedFontIds: string[] = [];
  try {
    for (const [assetId, bytes] of images) {
      if (existingImageIds.has(assetId)) continue;
      const { error } = await requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).upload(
        imageStoragePath(ownerUserId, documentId, assetId),
        bytes,
        { contentType: 'image/webp', cacheControl: '3600', upsert: false },
      );
      if (error) throw new StudioDocumentStoreError('Unable to store private Studio artwork.');
      uploadedAssetIds.push(assetId);
    }
    for (const [assetId, font] of fonts) {
      if (existingFontIds.has(assetId)) continue;
      const { error } = await requireStore().storage.from(STUDIO_DOCUMENT_FONT_BUCKET).upload(
        fontStoragePath(ownerUserId, documentId, assetId),
        font.bytes,
        { contentType: font.mimeType, cacheControl: '3600', upsert: false },
      );
      if (error) throw new StudioDocumentStoreError('Unable to store a private Studio font.');
      uploadedFontIds.push(assetId);
    }
  } catch (error) {
    await cleanupUploadedStudioDocumentAssets({ ownerUserId, documentId, uploadedAssetIds, uploadedFontIds });
    throw error;
  }
  return { document: storedDocument, uploadedAssetIds, uploadedFontIds };
};

export const cleanupUploadedStudioDocumentAssets = async ({
  ownerUserId,
  documentId,
  uploadedAssetIds,
  uploadedFontIds = [],
}: {
  ownerUserId: string;
  documentId: string;
  uploadedAssetIds: string[];
  uploadedFontIds?: string[];
}): Promise<void> => {
  if (uploadedAssetIds.length === 0 && uploadedFontIds.length === 0) return;
  const store = requireStore();
  const { data, error } = await store
    .from('cardforge_studio_documents')
    .select('document_payload')
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) {
    console.error('Unable to reconcile failed Studio asset upload:', error);
    return;
  }
  const referencedImages = new Set(collectStudioDocumentAssetIds(data?.document_payload));
  const referencedFonts = new Set(collectStudioDocumentFontIds(data?.document_payload));
  const staleImagePaths = uploadedAssetIds
    .filter((id) => !referencedImages.has(id))
    .map((id) => imageStoragePath(ownerUserId, documentId, id));
  const staleFontPaths = uploadedFontIds
    .filter((id) => !referencedFonts.has(id))
    .map((id) => fontStoragePath(ownerUserId, documentId, id));
  await Promise.all([
    staleImagePaths.length > 0 ? store.storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).remove(staleImagePaths) : Promise.resolve({ error: null }),
    staleFontPaths.length > 0 ? store.storage.from(STUDIO_DOCUMENT_FONT_BUCKET).remove(staleFontPaths) : Promise.resolve({ error: null }),
  ]).then(([imagesRemoved, fontsRemoved]) => {
    if (imagesRemoved.error) console.error('Unable to roll back failed Studio artwork upload:', imagesRemoved.error);
    if (fontsRemoved.error) console.error('Unable to roll back failed Studio font upload:', fontsRemoved.error);
  });
};

const collectFontMimeTypes = (value: unknown, output = new Map<string, ProjectFontMimeType>()): Map<string, ProjectFontMimeType> => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectFontMimeTypes(entry, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === 'string' && typeof record.mimeType === 'string') {
    const id = getStudioDocumentFontIdFromReference(record.dataUrl);
    const mimeType = record.mimeType.toLowerCase();
    if (id && isProjectFontMimeType(mimeType)) output.set(id, mimeType);
  }
  Object.values(record).forEach((entry) => collectFontMimeTypes(entry, output));
  return output;
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
  const imageIds = collectStudioDocumentAssetIds(value);
  const fontIds = collectStudioDocumentFontIds(value);
  if (imageIds.length === 0 && fontIds.length === 0) return [];
  const prefix = storagePrefix(ownerUserId, documentId);
  const imagePaths = imageIds.map((id) => imageStoragePath(ownerUserId, documentId, id));
  const fontPaths = fontIds.map((id) => fontStoragePath(ownerUserId, documentId, id));
  const [imageSigned, fontSigned, fontList] = await Promise.all([
    imagePaths.length > 0
      ? requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).createSignedUrls(imagePaths, 15 * 60)
      : Promise.resolve({ data: [], error: null }),
    fontPaths.length > 0
      ? requireStore().storage.from(STUDIO_DOCUMENT_FONT_BUCKET).createSignedUrls(fontPaths, 15 * 60)
      : Promise.resolve({ data: [], error: null }),
    fontIds.length > 0
      ? requireStore().storage.from(STUDIO_DOCUMENT_FONT_BUCKET).list(prefix, { limit: MAX_STUDIO_DOCUMENT_FONTS })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (imageSigned.error || fontSigned.error || fontList.error) {
    throw new StudioDocumentStoreError('Unable to authorize private Studio asset downloads.');
  }
  const imageUrlByPath = new Map((imageSigned.data ?? []).map((item) => [item.path, item.signedUrl]));
  const fontUrlByPath = new Map((fontSigned.data ?? []).map((item) => [item.path, item.signedUrl]));
  const mimeFromDocument = collectFontMimeTypes(value);
  const mimeFromStorage = new Map<string, string>();
  (fontList.data ?? []).forEach((item) => {
    const mimeType = readObjectMimeType(item);
    if (item.name && mimeType) mimeFromStorage.set(item.name, mimeType);
  });

  const imageDownloads = imageIds.map((id): StudioDocumentAssetDownload => {
    const signedUrl = imageUrlByPath.get(imageStoragePath(ownerUserId, documentId, id));
    if (!signedUrl) throw new StudioDocumentStoreError('One of this document’s private artwork files is unavailable.');
    return { id, kind: 'image', mimeType: 'image/webp', size: null, signedUrl };
  });
  const fontDownloads = fontIds.map((id): StudioDocumentAssetDownload => {
    const signedUrl = fontUrlByPath.get(fontStoragePath(ownerUserId, documentId, id));
    const mimeType = mimeFromDocument.get(id) ?? mimeFromStorage.get(id) ?? '';
    if (!signedUrl || !isProjectFontMimeType(mimeType)) {
      throw new StudioDocumentStoreError('One of this document’s private font files is unavailable or has an unexpected format.');
    }
    return { id, kind: 'font', mimeType, size: null, signedUrl };
  });
  return [...imageDownloads, ...fontDownloads];
};

export const removeStudioDocumentAssets = async (ownerUserId: string, documentId: string): Promise<void> => {
  const prefix = storagePrefix(ownerUserId, documentId);
  const [images, fonts] = await Promise.all([
    requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).list(prefix, { limit: MAX_STUDIO_DOCUMENT_ASSETS }),
    requireStore().storage.from(STUDIO_DOCUMENT_FONT_BUCKET).list(prefix, { limit: MAX_STUDIO_DOCUMENT_FONTS }),
  ]);
  if (images.error || fonts.error) throw new StudioDocumentStoreError('Unable to inspect private Studio assets for removal.');
  const imagePaths = (images.data ?? []).map((item) => `${prefix}/${item.name}`);
  const fontPaths = (fonts.data ?? []).map((item) => `${prefix}/${item.name}`);
  const [imagesRemoved, fontsRemoved] = await Promise.all([
    imagePaths.length > 0 ? requireStore().storage.from(STUDIO_DOCUMENT_ASSET_BUCKET).remove(imagePaths) : Promise.resolve({ error: null }),
    fontPaths.length > 0 ? requireStore().storage.from(STUDIO_DOCUMENT_FONT_BUCKET).remove(fontPaths) : Promise.resolve({ error: null }),
  ]);
  if (imagesRemoved.error || fontsRemoved.error) throw new StudioDocumentStoreError('Unable to remove private Studio assets.');
};
