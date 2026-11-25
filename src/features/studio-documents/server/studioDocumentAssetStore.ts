import { createHash } from 'node:crypto';

import {
  isProjectFontMimeType,
  MAX_PROJECT_PACKAGE_ASSET_BYTES,
  MAX_PROJECT_PACKAGE_METADATA_BYTES,
  MAX_PROJECT_PACKAGE_ASSETS,
  isProjectPackageAssetMimeType,
  type ProjectPackageAssetMimeType,
  projectAssetArrayScope,
  projectAssetChildScope,
  type ProjectAssetScope,
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
import { StudioDocumentStoreError } from './StudioDocumentStoreError';

const DATA_IMAGE_PATTERN = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/u;
const DATA_FONT_PATTERN = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/u;

const requireStore = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new StudioDocumentStoreError('Studio document asset storage is not configured yet.', 503);
  return supabase;
};

const storagePrefix = (ownerUserId: string, documentId: string) => `${ownerUserId}/${documentId}`;
// Retain the historical key shape for old drafts; object metadata owns MIME.
const imageStoragePath = (ownerUserId: string, documentId: string, assetId: string) => (
  `${storagePrefix(ownerUserId, documentId)}/${assetId}.webp`
);
const fontStoragePath = (ownerUserId: string, documentId: string, assetId: string) => (
  `${storagePrefix(ownerUserId, documentId)}/${assetId}`
);

const privateAssetLocation = (ownerUserId: string, documentId: string, id: string, mimeType: string) => {
  if (!/^[a-f0-9]{64}$/u.test(id) || (mimeType !== 'application/json' && !isProjectPackageAssetMimeType(mimeType))) throw new StudioDocumentStoreError('The private asset identity or format is invalid.', 400);
  if (mimeType === 'application/json') return { bucket: STUDIO_DOCUMENT_ASSET_BUCKET, path: `${storagePrefix(ownerUserId, documentId)}/template-${id}.json` };
  return mimeType.startsWith('image/')
    ? { bucket: STUDIO_DOCUMENT_ASSET_BUCKET, path: imageStoragePath(ownerUserId, documentId, id) }
    : { bucket: STUDIO_DOCUMENT_FONT_BUCKET, path: fontStoragePath(ownerUserId, documentId, id) };
};

export const verifyPrivateStudioAsset = async (ownerUserId: string, documentId: string, id: string, mimeType: string, expectedSize?: number): Promise<boolean> => {
  const { bucket, path } = privateAssetLocation(ownerUserId, documentId, id, mimeType);
  const { data, error } = await requireStore().storage.from(bucket).download(path);
  if (error) {
    if (Number(error.statusCode ?? error.status) === 404) return false;
    throw new StudioDocumentStoreError('Private artwork storage is unavailable. The local draft was kept.', 503);
  }
  if (!data) throw new StudioDocumentStoreError('The private artwork read could not be confirmed. The local draft was kept.', 503);
  if (data.size < 1 || data.size > (mimeType === 'application/json' ? MAX_PROJECT_PACKAGE_METADATA_BYTES : MAX_PROJECT_PACKAGE_ASSET_BYTES) || (expectedSize !== undefined && data.size !== expectedSize) || (data.type && data.type !== mimeType)) return false;
  return createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex') === id;
};

export const preparePrivateStudioAssetUpload = async ({ ownerUserId, documentId, id, mimeType, size }: { ownerUserId: string; documentId: string; id: string; mimeType: string; size: number }) => {
  if (!Number.isSafeInteger(size) || size < 1 || size > (mimeType === 'application/json' ? MAX_PROJECT_PACKAGE_METADATA_BYTES : MAX_PROJECT_PACKAGE_ASSET_BYTES)) throw new StudioDocumentStoreError('The private asset exceeds the portable project asset limit.', 413);
  const { bucket, path } = privateAssetLocation(ownerUserId, documentId, id, mimeType);
  if (await verifyPrivateStudioAsset(ownerUserId, documentId, id, mimeType, size)) return { alreadyPresent: true, signedUrl: null };
  const storage = requireStore().storage.from(bucket);
  const existing = await storage.info(path);
  if (existing.data) throw new StudioDocumentStoreError('A private asset at this address has different content or metadata. The working draft was not changed.', 409);
  if (!existing.error || Number(existing.error.statusCode ?? existing.error.status) !== 404) throw new StudioDocumentStoreError('Private artwork storage is unavailable. The local draft was kept.', 503);
  const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false });
  if (error || !data?.signedUrl) throw new StudioDocumentStoreError('Unable to prepare the private artwork transfer.', 503);
  return { alreadyPresent: false, signedUrl: data.signedUrl };
};

export const readPrivateStudioTemplate = async (ownerUserId: string, documentId: string, id: string): Promise<unknown> => {
  const { bucket, path } = privateAssetLocation(ownerUserId, documentId, id, 'application/json');
  const { data, error } = await requireStore().storage.from(bucket).download(path);
  if (error || !data || data.size < 1 || data.size > MAX_PROJECT_PACKAGE_METADATA_BYTES || (data.type && data.type !== 'application/json')) throw new StudioDocumentStoreError('The transferred Template is unavailable. The working draft was not changed.', 503);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== id) throw new StudioDocumentStoreError('The transferred Template failed its integrity check.', 409);
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new StudioDocumentStoreError('The transferred Template is invalid.', 400); }
};

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
  if (bytes.length <= 0 || bytes.length > MAX_PROJECT_PACKAGE_ASSET_BYTES) {
    throw new StudioDocumentStoreError('A private Studio asset exceeds the portable project asset limit.', 413);
  }
  return { mimeType, bytes };
};

export const externalizeStudioDocumentAssets = async ({
  ownerUserId,
  documentId,
  document,
  cleanupOnFailure = true,
}: {
  ownerUserId: string;
  documentId: string;
  document: ProjectDocumentV1;
  /**
   * Safe for brand-new document ids only. Existing revision updates retain newly
   * uploaded content-addressed objects until document retention owns prefix cleanup;
   * a stale writer must never delete bytes a concurrent successful revision may reuse.
   */
  cleanupOnFailure?: boolean;
}): Promise<{ document: ProjectDocumentV1; uploadedAssetIds: string[]; uploadedFontIds: string[] }> => {
  const pendingImages = new Map<string, { id: string; bytes: Buffer; mimeType: ProjectPackageAssetMimeType }>();
  const pendingFonts = new Map<string, { id: string; bytes: Buffer; mimeType: ProjectFontMimeType }>();
  const images = new Map<string, { bytes: Buffer; mimeType: ProjectPackageAssetMimeType }>();
  const fonts = new Map<string, { bytes: Buffer; mimeType: ProjectFontMimeType }>();

  const prepareImage = (value: string) => {
    const match = DATA_IMAGE_PATTERN.exec(value);
    if (!match) return null;
    const existing = pendingImages.get(value);
    if (existing) return existing;
    const mimeType = match[1].toLowerCase();
    if (!isProjectPackageAssetMimeType(mimeType)) return null;
    const bytes = Buffer.from(match[2].replace(/\s+/gu, ''), 'base64');
    if (!bytes.length || bytes.length > MAX_PROJECT_PACKAGE_ASSET_BYTES) {
      throw new StudioDocumentStoreError('A private Studio asset exceeds the portable project asset limit.', 413);
    }
    const prepared = { id: createHash('sha256').update(bytes).digest('hex'), bytes, mimeType };
    pendingImages.set(value, prepared);
    return prepared;
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

  const visit = async (value: unknown, scope: ProjectAssetScope = 'root'): Promise<unknown> => {
    if (scope === 'opaque') return value;
    if (typeof value === 'string') {
      const preparedImage = await prepareImage(value);
      if (preparedImage) {
        images.set(preparedImage.id, { bytes: preparedImage.bytes, mimeType: preparedImage.mimeType });
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
      if (value.startsWith('cardforge-browser-asset://') || value.startsWith('cardforge-project-asset://')) {
        throw new StudioDocumentStoreError('This artwork is only available in its original workspace. Keep the local copy and reopen the Studio draft before saving.', 409);
      }
      return value;
    }
    if (Array.isArray(value)) {
      const entries: unknown[] = [];
      for (const entry of value) entries.push(await visit(entry, projectAssetArrayScope(scope)));
      return entries;
    }
    if (value && typeof value === 'object') {
      const entries: Array<readonly [string, unknown]> = [];
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        entries.push([key, await visit(entry, projectAssetChildScope(scope, key))] as const);
      }
      return Object.fromEntries(entries);
    }
    return value;
  };

  const storedDocument = await visit(document) as ProjectDocumentV1;
  const referencedImageIds = collectStudioDocumentAssetIds(storedDocument);
  const referencedFontIds = collectStudioDocumentFontIds(storedDocument);
  if (new Set([...referencedImageIds, ...referencedFontIds]).size !== referencedImageIds.length + referencedFontIds.length || referencedImageIds.length + referencedFontIds.length > MAX_PROJECT_PACKAGE_ASSETS) {
    throw new StudioDocumentStoreError('The Studio document exceeds the portable project asset count or has ambiguous asset references.', 413);
  }
  if (referencedImageIds.length > MAX_STUDIO_DOCUMENT_ASSETS) {
    throw new StudioDocumentStoreError(`A Studio document can contain at most ${MAX_STUDIO_DOCUMENT_ASSETS} private artwork files.`, 413);
  }
  if (referencedFontIds.length > MAX_STUDIO_DOCUMENT_FONTS) {
    throw new StudioDocumentStoreError(`A Studio document can contain at most ${MAX_STUDIO_DOCUMENT_FONTS} private fonts.`, 413);
  }

  const prefix = storagePrefix(ownerUserId, documentId);
  const [existingImageList, existingFontList] = await Promise.all([
    listReferencedMetadata(STUDIO_DOCUMENT_ASSET_BUCKET, prefix, referencedImageIds.map((id) => `${id}.webp`)),
    listReferencedMetadata(STUDIO_DOCUMENT_FONT_BUCKET, prefix, referencedFontIds),
  ]);
  const imageSizes = new Map<string, number>();
  const existingImageIds = new Set<string>();
  existingImageList.forEach((item) => {
    const id = item.name.endsWith('.webp') ? item.name.slice(0, -5) : '';
    const size = readObjectSize(item);
    if (id) existingImageIds.add(id);
    if (id && size !== null) imageSizes.set(id, size);
  });
  const fontSizes = new Map<string, number>();
  const existingFontIds = new Set<string>();
  existingFontList.forEach((item) => {
    const id = item.name;
    const size = readObjectSize(item);
    if (id) existingFontIds.add(id);
    if (id && size !== null) fontSizes.set(id, size);
  });

  if (referencedImageIds.some((id) => !images.has(id) && !imageSizes.has(id)) || referencedFontIds.some((id) => !fonts.has(id) && !fontSizes.has(id))) {
    throw new StudioDocumentStoreError('Private Studio asset metadata is unavailable.', 503);
  }

  const totalBytes = referencedImageIds.reduce((total, id) => (
    total + (images.get(id)?.bytes.byteLength ?? imageSizes.get(id) ?? 0)
  ), 0) + referencedFontIds.reduce((total, id) => (
    total + (fonts.get(id)?.bytes.byteLength ?? fontSizes.get(id) ?? 0)
  ), 0);
  if (totalBytes > MAX_STUDIO_DOCUMENT_ASSET_STORAGE_BYTES) {
    throw new StudioDocumentStoreError('This Studio document exceeds the portable project asset budget.', 413);
  }

  const uploadedAssetIds: string[] = [];
  const uploadedFontIds: string[] = [];
  try {
    const uploads = [
      ...[...images].filter(([id]) => !existingImageIds.has(id)).map(([id, image]) => ({ id, ...image, bucket: STUDIO_DOCUMENT_ASSET_BUCKET, path: imageStoragePath(ownerUserId, documentId, id), uploaded: uploadedAssetIds })),
      ...[...fonts].filter(([id]) => !existingFontIds.has(id)).map(([id, font]) => ({ id, ...font, bucket: STUDIO_DOCUMENT_FONT_BUCKET, path: fontStoragePath(ownerUserId, documentId, id), uploaded: uploadedFontIds })),
    ];
    for (let start = 0; start < uploads.length; start += 8) {
      const batch = await Promise.allSettled(uploads.slice(start, start + 8).map(async (item) => {
        const { error } = await requireStore().storage.from(item.bucket).upload(item.path, item.bytes, { contentType: item.mimeType, cacheControl: '3600', upsert: false });
        if (error) throw new StudioDocumentStoreError('Unable to store a private Studio asset.');
        item.uploaded.push(item.id);
      }));
      const failure = batch.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    }
  } catch (error) {
    if (cleanupOnFailure) {
      await cleanupUploadedStudioDocumentAssets({ ownerUserId, documentId, uploadedAssetIds, uploadedFontIds });
    }
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

const collectFontMimeTypes = (value: unknown, output = new Map<string, ProjectFontMimeType>(), scope: ProjectAssetScope = 'root'): Map<string, ProjectFontMimeType> => {
  if (scope === 'opaque') return output;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectFontMimeTypes(entry, output, projectAssetArrayScope(scope)));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === 'string' && typeof record.mimeType === 'string') {
    const id = getStudioDocumentFontIdFromReference(record.dataUrl);
    const mimeType = record.mimeType.toLowerCase();
    if (id && isProjectFontMimeType(mimeType)) output.set(id, mimeType);
  }
  Object.entries(record).forEach(([key, entry]) => collectFontMimeTypes(entry, output, projectAssetChildScope(scope, key)));
  return output;
};

// Historical revisions retain objects in the same prefix. Inspect every page
// until the exact current references are found or the listing is exhausted.
const listReferencedMetadata = async (bucket: string, prefix: string, names: string[]) => {
  const remaining = new Set(names);
  const found = new Map<string, { name: string; metadata?: unknown }>();
  const pageSize = 256;
  let previousLast: string | undefined;
  for (let offset = 0; remaining.size > 0; offset += pageSize) {
    const { data, error } = await requireStore().storage.from(bucket).list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error || !Array.isArray(data) || data.some((item) => !item || typeof item.name !== 'string')) {
      throw new StudioDocumentStoreError('Private Studio asset metadata listing is unavailable or incomplete.', 503);
    }
    if (data.length > 0 && previousLast !== undefined && data[0].name <= previousLast) throw new StudioDocumentStoreError('Private Studio asset metadata listing did not advance.', 503);
    previousLast = data.at(-1)?.name;
    for (const item of data) if (remaining.delete(item.name)) found.set(item.name, item);
    if (data.length < pageSize) break;
  }
  return found;
};

const signAssetPaths = async (bucket: string, paths: string[]): Promise<Map<string, string>> => {
  const urls = new Map<string, string>();
  // Provider calls remain bounded even when a portable project uses thousands
  // of distinct assets; each URL is still owned by the document's prefix.
  for (let start = 0; start < paths.length; start += 100) {
    const { data, error } = await requireStore().storage.from(bucket).createSignedUrls(paths.slice(start, start + 100), 15 * 60);
    if (error || !data) throw new StudioDocumentStoreError('Unable to authorize private Studio asset downloads.');
    for (const item of data) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
};

export const getStudioDocumentAssetDownloads = async ({
  ownerUserId,
  documentId,
  value,
  requireVerifiedSize = false,
}: {
  ownerUserId: string;
  documentId: string;
  value: unknown;
  requireVerifiedSize?: boolean;
}): Promise<StudioDocumentAssetDownload[]> => {
  const imageIds = collectStudioDocumentAssetIds(value);
  const fontIds = collectStudioDocumentFontIds(value);
  if (imageIds.length === 0 && fontIds.length === 0) return [];
  const prefix = storagePrefix(ownerUserId, documentId);
  const imagePaths = imageIds.map((id) => imageStoragePath(ownerUserId, documentId, id));
  const fontPaths = fontIds.map((id) => fontStoragePath(ownerUserId, documentId, id));
  const [imageUrlByPath, fontUrlByPath, fontList, imageList] = await Promise.all([
    signAssetPaths(STUDIO_DOCUMENT_ASSET_BUCKET, imagePaths),
    signAssetPaths(STUDIO_DOCUMENT_FONT_BUCKET, fontPaths),
    fontIds.length > 0
      ? listReferencedMetadata(STUDIO_DOCUMENT_FONT_BUCKET, prefix, fontIds)
      : Promise.resolve(new Map()),
    imageIds.length > 0
      ? listReferencedMetadata(STUDIO_DOCUMENT_ASSET_BUCKET, prefix, imageIds.map((id) => `${id}.webp`))
      : Promise.resolve(new Map()),
  ]);
  const mimeFromDocument = collectFontMimeTypes(value);
  const mimeFromStorage = new Map<string, string>();
  fontList.forEach((item) => {
    const mimeType = readObjectMimeType(item);
    if (item.name && mimeType) mimeFromStorage.set(item.name, mimeType);
  });

  const imageDownloads = imageIds.map((id): StudioDocumentAssetDownload => {
    const signedUrl = imageUrlByPath.get(imageStoragePath(ownerUserId, documentId, id));
    if (!signedUrl) throw new StudioDocumentStoreError('One of this document’s private artwork files is unavailable.');
    const size = readObjectSize(imageList.get(`${id}.webp`));
    if (requireVerifiedSize && size === null) throw new StudioDocumentStoreError('Exact private artwork metadata is unavailable.', 503);
    const mimeType = readObjectMimeType(imageList.get(`${id}.webp`)) ?? 'image/webp';
    if (!isProjectPackageAssetMimeType(mimeType) || !mimeType.startsWith('image/')) throw new StudioDocumentStoreError('A private artwork file has an unsupported format.', 503);
    return { id, kind: 'image', mimeType, size, signedUrl };
  });
  const fontDownloads = fontIds.map((id): StudioDocumentAssetDownload => {
    const signedUrl = fontUrlByPath.get(fontStoragePath(ownerUserId, documentId, id));
    const mimeType = mimeFromDocument.get(id) ?? mimeFromStorage.get(id) ?? '';
    if (!signedUrl || !isProjectFontMimeType(mimeType)) {
      throw new StudioDocumentStoreError('One of this document’s private font files is unavailable or has an unexpected format.');
    }
    const size = readObjectSize(fontList.get(id));
    if (requireVerifiedSize && size === null) throw new StudioDocumentStoreError('Exact private font metadata is unavailable.', 503);
    return { id, kind: 'font', mimeType, size, signedUrl };
  });
  return [...imageDownloads, ...fontDownloads];
};

export const removeStudioDocumentAssets = async (ownerUserId: string, documentId: string): Promise<void> => {
  const prefix = storagePrefix(ownerUserId, documentId);
  const removeBucket = async (bucket: string) => {
    const storage = requireStore().storage.from(bucket);
    const names: string[] = [];
    for (let offset = 0;; offset += 256) {
      const { data, error } = await storage.list(prefix, { limit: 256, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error || !Array.isArray(data)) throw new StudioDocumentStoreError('Unable to inspect private Studio assets for removal.');
      if (data.length && names.length && data[0].name <= names[names.length - 1]) throw new StudioDocumentStoreError('Private Studio asset listing did not advance.', 503);
      names.push(...data.map((item) => item.name));
      if (data.length < 256) break;
    }
    for (let start = 0; start < names.length; start += 256) {
      const removed = await storage.remove(names.slice(start, start + 256).map((name) => `${prefix}/${name}`));
      if (removed.error) throw new StudioDocumentStoreError('Unable to remove private Studio assets.');
    }
  };
  await Promise.all([removeBucket(STUDIO_DOCUMENT_ASSET_BUCKET), removeBucket(STUDIO_DOCUMENT_FONT_BUCKET)]);
};
