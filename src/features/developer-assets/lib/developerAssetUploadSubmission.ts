import { nanoid } from 'nanoid';

import {
  isDeveloperAssetType,
  type DeveloperAssetType,
} from '@/features/developer-assets/lib/developerAssets';
import {
  type DeveloperAssetProgramView,
} from '@/features/developer-assets/lib/developerAssetProgram';
import {
  createDeveloperAssetSubmission,
  DeveloperAssetStoreError,
} from '@/features/developer-assets/lib/developerAssetStore';
import {
  DEVELOPER_ASSET_STORAGE_BUCKET,
  DEVELOPER_ASSET_UPLOAD_ALLOWED_MIME_TYPES,
  DEVELOPER_ASSET_UPLOAD_MAX_BYTES,
} from '@/features/developer-assets/lib/developerAssetUploadPolicy';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

const ALLOWED_MIME_TYPES = new Set<string>(DEVELOPER_ASSET_UPLOAD_ALLOWED_MIME_TYPES);
const FONT_EXTENSIONS = new Set(['woff2', 'woff', 'ttf', 'otf']);
const NON_FONT_EXTENSIONS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'json']);

const sanitizeFileStem = (value: string): string => value
  .replace(/\.[^.]+$/u, '')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/gu, '-')
  .replace(/^-+|-+$/gu, '')
  .slice(0, 80) || 'asset';

const getFileExtension = (file: File): string => {
  const nameExtension = file.name.match(/\.([a-z0-9]+)$/iu)?.[1]?.toLowerCase();
  if (nameExtension) return nameExtension === 'jpeg' ? 'jpg' : nameExtension;
  if (file.type === 'image/svg+xml') return 'svg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'application/json') return 'json';
  if (file.type === 'font/woff2') return 'woff2';
  if (file.type === 'font/woff' || file.type === 'application/font-woff') return 'woff';
  if (file.type === 'font/ttf' || file.type === 'application/x-font-ttf') return 'ttf';
  if (file.type === 'font/otf' || file.type === 'application/x-font-otf') return 'otf';
  return '';
};

const validateSourceFile = (file: File, assetType: DeveloperAssetType): string => {
  if (file.size <= 0 || file.size > DEVELOPER_ASSET_UPLOAD_MAX_BYTES) {
    throw new DeveloperAssetStoreError('Developer asset files must be 10 MB or smaller.', 413);
  }

  const extension = getFileExtension(file);
  const isFontUpload = assetType === 'fonts';
  const extensionAllowed = isFontUpload
    ? FONT_EXTENSIONS.has(extension)
    : NON_FONT_EXTENSIONS.has(extension);
  if (!extensionAllowed || (file.type && !ALLOWED_MIME_TYPES.has(file.type))) {
    throw new DeveloperAssetStoreError(
      isFontUpload
        ? 'Upload WOFF2, WOFF, TTF, or OTF font assets.'
        : 'Upload SVG, PNG, JPG, WEBP, or JSON assets.',
      400,
    );
  }
  return extension;
};

export interface CreateUploadedDeveloperAssetSubmissionInput {
  developerId: string;
  developerEmail: string | null;
  currentContributorIds: string[];
  includeRegistryRecipePayloads?: boolean;
  assetType: unknown;
  name: unknown;
  description: unknown;
  previewUrl: unknown;
  file: File;
}

export const createUploadedDeveloperAssetSubmission = async ({
  developerId,
  developerEmail,
  currentContributorIds,
  includeRegistryRecipePayloads = false,
  assetType: assetTypeValue,
  name,
  description,
  previewUrl,
  file,
}: CreateUploadedDeveloperAssetSubmissionInput): Promise<DeveloperAssetProgramView> => {
  if (!isDeveloperAssetType(assetTypeValue)) {
    throw new DeveloperAssetStoreError('Choose a supported asset type.', 400);
  }
  const extension = validateSourceFile(file, assetTypeValue);
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new DeveloperAssetStoreError('Developer asset storage is not configured yet.', 503);
  }

  const storagePath = [
    developerId,
    assetTypeValue,
    `${Date.now()}-${sanitizeFileStem(file.name)}-${nanoid(8)}.${extension}`,
  ].join('/');
  const storage = supabase.storage.from(DEVELOPER_ASSET_STORAGE_BUCKET);
  const { error: uploadError } = await storage.upload(storagePath, await file.arrayBuffer(), {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (uploadError) {
    throw new DeveloperAssetStoreError('Unable to upload developer asset file.', 500);
  }

  const { data } = storage.getPublicUrl(storagePath);
  try {
    return await createDeveloperAssetSubmission({
      developerId,
      developerEmail,
      currentContributorIds,
      includeRegistryRecipePayloads,
      input: {
        assetType: assetTypeValue,
        name,
        description,
        previewUrl: typeof previewUrl === 'string' && previewUrl.trim() ? previewUrl.trim() : data.publicUrl,
        sourceUrl: data.publicUrl,
        sourceFileSizeBytes: file.size,
        sourceMimeType: file.type || 'application/octet-stream',
        sourceStorageBucket: DEVELOPER_ASSET_STORAGE_BUCKET,
        sourceStoragePath: storagePath,
      },
    });
  } catch (error) {
    const { error: cleanupError } = await storage.remove([storagePath]);
    if (cleanupError) {
      console.error('Failed to compensate developer asset upload:', cleanupError);
    }
    throw error;
  }
};
