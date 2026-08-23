import { nanoid } from 'nanoid';

import {
  isDeveloperUploadAssetType,
  type DeveloperUploadAssetType,
} from '@/features/developer-assets/lib/developerAssets';
import {
  isStudioAssetDestination,
  type StudioAssetDestination,
} from '@/domain/templates';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import {
  createDeveloperAssetSubmission,
  DeveloperAssetStoreError,
} from '@/features/developer-assets/lib/developerAssetStore';
import {
  DEVELOPER_ASSET_STORAGE_BUCKET,
  DEVELOPER_ASSET_UPLOAD_ALLOWED_MIME_TYPES,
  getDeveloperAssetUploadMaxBytes,
  type DeveloperAssetUploadedFile,
  type DeveloperAssetUploadPlan,
} from '@/features/developer-assets/lib/developerAssetUploadPolicy';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getDeveloperAssetStudioDestinationOptions } from './pipelineAssetTaxonomy';

const ALLOWED_MIME_TYPES = new Set<string>(DEVELOPER_ASSET_UPLOAD_ALLOWED_MIME_TYPES);
const FONT_EXTENSIONS = new Set(['woff2', 'woff', 'ttf', 'otf']);
const IMAGE_EXTENSIONS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp']);
const BORDER_OVERLAY_EXTENSIONS = new Set(['svg', 'png', 'webp']);

const sanitizePathSegment = (value: string, fallback: string, maxLength = 100): string => (
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, maxLength) || fallback
);

const sanitizeFileStem = (value: string): string => sanitizePathSegment(
  value.replace(/\.[^.]+$/u, ''),
  'asset',
  80,
);

const getFileExtension = (fileName: string, mimeType: string): string => {
  const nameExtension = fileName.match(/\.([a-z0-9]+)$/iu)?.[1]?.toLowerCase();
  if (nameExtension) return nameExtension === 'jpeg' ? 'jpg' : nameExtension;
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'font/woff2') return 'woff2';
  if (mimeType === 'font/woff' || mimeType === 'application/font-woff') return 'woff';
  if (mimeType === 'font/ttf' || mimeType === 'application/x-font-ttf') return 'ttf';
  if (mimeType === 'font/otf' || mimeType === 'application/x-font-otf') return 'otf';
  return '';
};

const isBorderOverlayDestination = (destination: StudioAssetDestination): boolean =>
  destination === 'image.border.front' || destination === 'image.border.back';

interface ValidatedUploadDescriptor {
  assetType: DeveloperUploadAssetType;
  studioDestination: StudioAssetDestination;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  extension: string;
  maxFileSizeBytes: number;
}

export const validateDeveloperAssetUploadDescriptor = ({
  assetType,
  studioDestination,
  fileName,
  fileSizeBytes,
  mimeType,
  maxFileSizeMb,
}: {
  assetType: unknown;
  studioDestination: unknown;
  fileName: unknown;
  fileSizeBytes: unknown;
  mimeType: unknown;
  maxFileSizeMb: number;
}): ValidatedUploadDescriptor => {
  if (!isDeveloperUploadAssetType(assetType)) {
    throw new DeveloperAssetStoreError(
      'Templates and Styles are authored in Studio. Use this upload form for media and font assets.',
      400,
    );
  }
  if (
    !isStudioAssetDestination(studioDestination)
    || !getDeveloperAssetStudioDestinationOptions(assetType).includes(studioDestination)
  ) {
    throw new DeveloperAssetStoreError('Choose a Studio destination compatible with this asset type.', 400);
  }
  const normalizedFileName = typeof fileName === 'string' ? fileName.trim().slice(0, 240) : '';
  const normalizedMimeType = typeof mimeType === 'string' && mimeType.trim()
    ? mimeType.trim().toLowerCase()
    : 'application/octet-stream';
  const normalizedFileSize = Number(fileSizeBytes);
  const maxFileSizeBytes = getDeveloperAssetUploadMaxBytes(maxFileSizeMb);
  if (!normalizedFileName) {
    throw new DeveloperAssetStoreError('Choose a named source file to upload.', 400);
  }
  if (!Number.isInteger(normalizedFileSize) || normalizedFileSize <= 0 || normalizedFileSize > maxFileSizeBytes) {
    throw new DeveloperAssetStoreError(
      `Forge Review source files must be ${Math.round(maxFileSizeBytes / 1024 / 1024)} MB or smaller. This limit is chosen in the Owner Console.`,
      413,
      {
        kind: 'limit',
        nextAction: 'Choose a smaller source file or ask the owner to raise the Forge Review file ceiling.',
        limit: {
          resource: 'developer_source_file_bytes',
          current: normalizedFileSize,
          maximum: maxFileSizeBytes,
          unit: 'bytes',
        },
      },
    );
  }

  const extension = getFileExtension(normalizedFileName, normalizedMimeType);
  const isFontUpload = assetType === 'fonts';
  const extensionAllowed = isFontUpload
    ? FONT_EXTENSIONS.has(extension)
    : IMAGE_EXTENSIONS.has(extension);
  if (!extensionAllowed || !ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
    throw new DeveloperAssetStoreError(
      isFontUpload
        ? 'Upload WOFF2, WOFF, TTF, or OTF font assets.'
        : 'Upload SVG, PNG, JPG, or WEBP artwork.',
      400,
    );
  }
  if (isBorderOverlayDestination(studioDestination) && !BORDER_OVERLAY_EXTENSIONS.has(extension)) {
    throw new DeveloperAssetStoreError(
      'Professional border overlays must use SVG, PNG, or WEBP so transparency can be preserved.',
      400,
    );
  }
  return {
    assetType,
    studioDestination,
    fileName: normalizedFileName,
    fileSizeBytes: normalizedFileSize,
    mimeType: normalizedMimeType,
    extension,
    maxFileSizeBytes,
  };
};

const getDeveloperStoragePrefix = (developerId: string): string => sanitizePathSegment(
  developerId,
  'developer',
  100,
);

const createStoragePath = (
  developerId: string,
  descriptor: ValidatedUploadDescriptor,
): string => [
  getDeveloperStoragePrefix(developerId),
  descriptor.assetType,
  `${Date.now()}-${sanitizeFileStem(descriptor.fileName)}-${nanoid(12)}.${descriptor.extension}`,
].join('/');

const requireSupabase = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new DeveloperAssetStoreError('Developer asset storage is not configured yet.', 503);
  }
  return supabase;
};

const requireStorage = () => requireSupabase().storage.from(DEVELOPER_ASSET_STORAGE_BUCKET);

export const prepareDeveloperAssetUpload = async ({
  developerId,
  maxFileSizeMb,
  assetType,
  studioDestination,
  fileName,
  fileSizeBytes,
  mimeType,
}: {
  developerId: string;
  maxFileSizeMb: number;
  assetType: unknown;
  studioDestination: unknown;
  fileName: unknown;
  fileSizeBytes: unknown;
  mimeType: unknown;
}): Promise<DeveloperAssetUploadPlan> => {
  const descriptor = validateDeveloperAssetUploadDescriptor({
    assetType,
    studioDestination,
    fileName,
    fileSizeBytes,
    mimeType,
    maxFileSizeMb,
  });
  const storagePath = createStoragePath(developerId, descriptor);
  const { data, error } = await requireStorage().createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.signedUrl) {
    throw new DeveloperAssetStoreError('Unable to prepare the Forge Review source upload.', 503);
  }
  return {
    signedUrl: data.signedUrl,
    storagePath,
    fileName: descriptor.fileName,
    fileSizeBytes: descriptor.fileSizeBytes,
    mimeType: descriptor.mimeType,
    maxFileSizeBytes: descriptor.maxFileSizeBytes,
  };
};

const assertOwnedStoragePath = (
  developerId: string,
  assetType: DeveloperUploadAssetType,
  storagePath: string,
): void => {
  const prefix = `${getDeveloperStoragePrefix(developerId)}/${assetType}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    throw new DeveloperAssetStoreError('The uploaded Forge Review source does not belong to this developer.', 403);
  }
};

const getStoredObjectSize = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const size = Number((metadata as Record<string, unknown>).size);
  return Number.isFinite(size) ? size : null;
};

const assertUploadedObjectComplete = async (
  storagePath: string,
  expectedSize: number,
): Promise<void> => {
  const separator = storagePath.lastIndexOf('/');
  const directory = storagePath.slice(0, separator);
  const objectName = storagePath.slice(separator + 1);
  const { data, error } = await requireStorage().list(directory, {
    limit: 2,
    search: objectName,
  });
  const stored = data?.find((entry) => entry.name === objectName);
  if (error || !stored || getStoredObjectSize(stored) !== expectedSize) {
    throw new DeveloperAssetStoreError(
      'The Forge Review source upload is incomplete or changed. Upload the file again.',
      409,
    );
  }
};

export const removePendingDeveloperAssetUpload = async ({
  developerId,
  assetType,
  storagePath,
}: {
  developerId: string;
  assetType: unknown;
  storagePath: unknown;
}): Promise<void> => {
  if (!isDeveloperUploadAssetType(assetType) || typeof storagePath !== 'string') return;
  assertOwnedStoragePath(developerId, assetType, storagePath);
  const supabase = requireSupabase();
  const { data: submitted, error: lookupError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id')
    .eq('developer_id', developerId)
    .eq('source_storage_bucket', DEVELOPER_ASSET_STORAGE_BUCKET)
    .eq('source_storage_path', storagePath)
    .maybeSingle();
  if (lookupError) {
    throw new DeveloperAssetStoreError('Unable to verify the unfinished Forge Review upload.', 503);
  }
  if (submitted) {
    throw new DeveloperAssetStoreError('A submitted Forge Review source cannot be removed as an unfinished upload.', 409);
  }
  const { error } = await supabase.storage.from(DEVELOPER_ASSET_STORAGE_BUCKET).remove([storagePath]);
  if (error) throw new DeveloperAssetStoreError('Unable to clean up the unfinished Forge Review upload.', 503);
};

export interface CreateUploadedDeveloperAssetSubmissionInput {
  developerId: string;
  developerEmail: string | null;
  currentContributorIds: string[];
  includeRegistryRecipePayloads?: boolean;
  maxFileSizeMb: number;
  assetType: unknown;
  studioDestination: unknown;
  specialtyTags: unknown;
  useCaseTags: unknown;
  name: unknown;
  description: unknown;
  previewUrl: unknown;
  uploadedFile: DeveloperAssetUploadedFile;
}

export const createUploadedDeveloperAssetSubmission = async ({
  developerId,
  developerEmail,
  currentContributorIds,
  includeRegistryRecipePayloads = false,
  maxFileSizeMb,
  assetType,
  studioDestination,
  specialtyTags,
  useCaseTags,
  name,
  description,
  previewUrl,
  uploadedFile,
}: CreateUploadedDeveloperAssetSubmissionInput): Promise<DeveloperAssetProgramView> => {
  const descriptor = validateDeveloperAssetUploadDescriptor({
    assetType,
    studioDestination,
    fileName: uploadedFile.fileName,
    fileSizeBytes: uploadedFile.fileSizeBytes,
    mimeType: uploadedFile.mimeType,
    maxFileSizeMb,
  });
  assertOwnedStoragePath(developerId, descriptor.assetType, uploadedFile.storagePath);
  const storage = requireStorage();

  try {
    await assertUploadedObjectComplete(uploadedFile.storagePath, descriptor.fileSizeBytes);
    const { data } = storage.getPublicUrl(uploadedFile.storagePath);
    return await createDeveloperAssetSubmission({
      developerId,
      developerEmail,
      currentContributorIds,
      includeRegistryRecipePayloads,
      input: {
        assetType: descriptor.assetType,
        studioDestination: descriptor.studioDestination,
        specialtyTags,
        useCaseTags,
        name,
        description,
        previewUrl: typeof previewUrl === 'string' && previewUrl.trim() ? previewUrl.trim() : data.publicUrl,
        sourceUrl: data.publicUrl,
        sourceFileSizeBytes: descriptor.fileSizeBytes,
        sourceMimeType: descriptor.mimeType,
        sourceStorageBucket: DEVELOPER_ASSET_STORAGE_BUCKET,
        sourceStoragePath: uploadedFile.storagePath,
      },
    });
  } catch (error) {
    const { error: cleanupError } = await storage.remove([uploadedFile.storagePath]);
    if (cleanupError) console.error('Failed to compensate developer asset upload:', cleanupError);
    throw error;
  }
};
