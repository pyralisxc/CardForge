import { nanoid } from 'nanoid';

import {
  isContributorUploadAssetType,
  type ContributorUploadAssetType,
} from '@/features/pipeline/lib/pipelineItems';
import {
  isStudioAssetDestination,
  type StudioAssetDestination,
} from '@/domain/templates';
import {
  createPipelineSubmission,
  PipelineStoreError,
} from '@/features/pipeline/lib/pipelineStore';
import {
  PIPELINE_STORAGE_BUCKET,
  PIPELINE_UPLOAD_ALLOWED_MIME_TYPES,
  getPipelineUploadMaxBytes,
  type PipelineUploadedFile,
  type PipelineUploadPlan,
} from '@/features/pipeline/lib/pipelineUploadPolicy';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  decodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  ProjectPackageError,
} from '@/features/project/server';
import { getPipelineStudioDestinationOptions } from './pipelineAssetTaxonomy';

const ALLOWED_MIME_TYPES = new Set<string>(PIPELINE_UPLOAD_ALLOWED_MIME_TYPES);
const FONT_EXTENSIONS = new Set(['woff2', 'woff', 'ttf', 'otf']);
const IMAGE_EXTENSIONS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp']);
const BORDER_OVERLAY_EXTENSIONS = new Set(['svg', 'png', 'webp']);
const SET_EXTENSIONS = new Set(['cardforge']);

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
  if (mimeType === 'application/vnd.cardforge.project+zip') return 'cardforge';
  return '';
};

const isBorderOverlayDestination = (destination: StudioAssetDestination): boolean =>
  destination === 'image.border.front' || destination === 'image.border.back';

interface ValidatedUploadDescriptor {
  assetType: ContributorUploadAssetType;
  studioDestination: StudioAssetDestination | null;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  extension: string;
  maxFileSizeBytes: number;
}

export const validatePipelineUploadDescriptor = ({
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
  if (!isContributorUploadAssetType(assetType)) {
    throw new PipelineStoreError(
      'Templates and Styles are authored in Studio. Use this upload form for media and font assets.',
      400,
    );
  }
  const normalizedDestination = assetType === 'sets'
    ? null
    : isStudioAssetDestination(studioDestination)
      ? studioDestination
      : null;
  if (assetType !== 'sets' && (
    !normalizedDestination
    || !getPipelineStudioDestinationOptions(assetType).includes(normalizedDestination)
  )) {
    throw new PipelineStoreError('Choose a Studio destination compatible with this asset type.', 400);
  }
  const normalizedFileName = typeof fileName === 'string' ? fileName.trim().slice(0, 240) : '';
  const normalizedMimeType = typeof mimeType === 'string' && mimeType.trim()
    ? mimeType.trim().toLowerCase()
    : 'application/octet-stream';
  const normalizedFileSize = Number(fileSizeBytes);
  const maxFileSizeBytes = getPipelineUploadMaxBytes(maxFileSizeMb);
  if (!normalizedFileName) {
    throw new PipelineStoreError('Choose a named source file to upload.', 400);
  }
  if (!Number.isInteger(normalizedFileSize) || normalizedFileSize <= 0 || normalizedFileSize > maxFileSizeBytes) {
    throw new PipelineStoreError(
      `Forge Review source files must be ${Math.round(maxFileSizeBytes / 1024 / 1024)} MB or smaller. This limit is chosen in the Owner Console.`,
      413,
      {
        kind: 'limit',
        nextAction: 'Choose a smaller source file or ask the owner to raise the Forge Review file ceiling.',
        limit: {
          resource: 'contributor_source_file_bytes',
          current: normalizedFileSize,
          maximum: maxFileSizeBytes,
          unit: 'bytes',
        },
      },
    );
  }

  const extension = getFileExtension(normalizedFileName, normalizedMimeType);
  const isFontUpload = assetType === 'fonts';
  const isSetUpload = assetType === 'sets';
  const extensionAllowed = isSetUpload
    ? SET_EXTENSIONS.has(extension)
    : isFontUpload
      ? FONT_EXTENSIONS.has(extension)
      : IMAGE_EXTENSIONS.has(extension);
  if (!extensionAllowed || !ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
    throw new PipelineStoreError(
      isSetUpload
        ? 'Upload a portable .cardforge Set package.'
        : isFontUpload
        ? 'Upload WOFF2, WOFF, TTF, or OTF font assets.'
        : 'Upload SVG, PNG, JPG, or WEBP artwork.',
      400,
    );
  }
  if (normalizedDestination && isBorderOverlayDestination(normalizedDestination) && !BORDER_OVERLAY_EXTENSIONS.has(extension)) {
    throw new PipelineStoreError(
      'Professional border overlays must use SVG, PNG, or WEBP so transparency can be preserved.',
      400,
    );
  }
  return {
    assetType,
    studioDestination: normalizedDestination,
    fileName: normalizedFileName,
    fileSizeBytes: normalizedFileSize,
    mimeType: normalizedMimeType,
    extension,
    maxFileSizeBytes,
  };
};

const getContributorStoragePrefix = (contributorId: string): string => sanitizePathSegment(
  contributorId,
  'contributor',
  100,
);

const createStoragePath = (
  contributorId: string,
  descriptor: ValidatedUploadDescriptor,
): string => [
  getContributorStoragePrefix(contributorId),
  descriptor.assetType,
  `${Date.now()}-${sanitizeFileStem(descriptor.fileName)}-${nanoid(12)}.${descriptor.extension}`,
].join('/');

const requireSupabase = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new PipelineStoreError('Pipeline storage is not configured yet.', 503);
  }
  return supabase;
};

const requireStorage = () => requireSupabase().storage.from(PIPELINE_STORAGE_BUCKET);

export const preparePipelineUpload = async ({
  contributorId,
  maxFileSizeMb,
  assetType,
  studioDestination,
  fileName,
  fileSizeBytes,
  mimeType,
}: {
  contributorId: string;
  maxFileSizeMb: number;
  assetType: unknown;
  studioDestination: unknown;
  fileName: unknown;
  fileSizeBytes: unknown;
  mimeType: unknown;
}): Promise<PipelineUploadPlan> => {
  const descriptor = validatePipelineUploadDescriptor({
    assetType,
    studioDestination,
    fileName,
    fileSizeBytes,
    mimeType,
    maxFileSizeMb,
  });
  const storagePath = createStoragePath(contributorId, descriptor);
  const { data, error } = await requireStorage().createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.signedUrl) {
    throw new PipelineStoreError('Unable to prepare the Forge Review source upload.', 503);
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
  contributorId: string,
  assetType: ContributorUploadAssetType,
  storagePath: string,
): void => {
  const prefix = `${getContributorStoragePrefix(contributorId)}/${assetType}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    throw new PipelineStoreError('The uploaded Forge Review source does not belong to this Contributor.', 403);
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
    throw new PipelineStoreError(
      'The Forge Review source upload is incomplete or changed. Upload the file again.',
      409,
    );
  }
};

const assertUploadedSetPackage = async (storagePath: string): Promise<void> => {
  const { data, error } = await requireStorage().download(storagePath);
  if (error || !data) {
    throw new PipelineStoreError('The uploaded Set package could not be read for validation.', 503);
  }
  try {
    const snapshot = await decodeCardForgeProjectPackage(data);
    const document = hydrateCardForgeProjectSnapshot(snapshot);
    if (document.cardSets.length !== 1) {
      throw new PipelineStoreError('Publish one Set per portable package.', 400);
    }
    const setId = document.cardSets[0]?.id;
    if (!setId || !document.storedCards.some((card) => card.setId === setId)) {
      throw new PipelineStoreError('Published Set packages must contain at least one card.', 400);
    }
  } catch (error) {
    if (error instanceof PipelineStoreError) throw error;
    throw new PipelineStoreError(
      error instanceof ProjectPackageError ? error.message : 'The uploaded file is not a valid portable CardForge Set.',
      400,
    );
  }
};

export const removePendingPipelineUpload = async ({
  contributorId,
  assetType,
  storagePath,
}: {
  contributorId: string;
  assetType: unknown;
  storagePath: unknown;
}): Promise<void> => {
  if (!isContributorUploadAssetType(assetType) || typeof storagePath !== 'string') return;
  assertOwnedStoragePath(contributorId, assetType, storagePath);
  const supabase = requireSupabase();
  const { data: submitted, error: lookupError } = await supabase
    .from('cardforge_contributor_asset_submissions')
    .select('id')
    .eq('contributor_id', contributorId)
    .eq('source_storage_bucket', PIPELINE_STORAGE_BUCKET)
    .eq('source_storage_path', storagePath)
    .maybeSingle();
  if (lookupError) {
    throw new PipelineStoreError('Unable to verify the unfinished Forge Review upload.', 503);
  }
  if (submitted) {
    throw new PipelineStoreError('A submitted Forge Review source cannot be removed as an unfinished upload.', 409);
  }
  const { error } = await supabase.storage.from(PIPELINE_STORAGE_BUCKET).remove([storagePath]);
  if (error) throw new PipelineStoreError('Unable to clean up the unfinished Forge Review upload.', 503);
};

export interface CreateUploadedPipelineSubmissionInput {
  contributorId: string;
  contributorEmail: string | null;
  maxFileSizeMb: number;
  assetType: unknown;
  studioDestination: unknown;
  specialtyTags: unknown;
  useCaseTags: unknown;
  name: unknown;
  description: unknown;
  previewUrl: unknown;
  uploadedFile: PipelineUploadedFile;
}

export const createUploadedPipelineSubmission = async ({
  contributorId,
  contributorEmail,
  maxFileSizeMb,
  assetType,
  studioDestination,
  specialtyTags,
  useCaseTags,
  name,
  description,
  previewUrl,
  uploadedFile,
}: CreateUploadedPipelineSubmissionInput): Promise<void> => {
  const descriptor = validatePipelineUploadDescriptor({
    assetType,
    studioDestination,
    fileName: uploadedFile.fileName,
    fileSizeBytes: uploadedFile.fileSizeBytes,
    mimeType: uploadedFile.mimeType,
    maxFileSizeMb,
  });
  assertOwnedStoragePath(contributorId, descriptor.assetType, uploadedFile.storagePath);
  const storage = requireStorage();

  try {
    await assertUploadedObjectComplete(uploadedFile.storagePath, descriptor.fileSizeBytes);
    if (descriptor.assetType === 'sets') await assertUploadedSetPackage(uploadedFile.storagePath);
    const { data } = storage.getPublicUrl(uploadedFile.storagePath);
    await createPipelineSubmission({
      contributorId,
      contributorEmail,
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
        sourceStorageBucket: PIPELINE_STORAGE_BUCKET,
        sourceStoragePath: uploadedFile.storagePath,
      },
    });
  } catch (error) {
    const { error: cleanupError } = await storage.remove([uploadedFile.storagePath]);
    if (cleanupError) console.error('Failed to compensate Pipeline upload:', cleanupError);
    throw error;
  }
};
