import type { CardForgeTransferV1 } from './cardTransfer';

export const CLOUD_SET_ASSET_BUCKET = 'cardforge-cloud-set-assets';
export const CLOUD_SET_ASSET_REFERENCE_PREFIX = 'cardforge-cloud-asset://';
export const MAX_CLOUD_SET_BYTES = 128 * 1024 * 1024;
export const MAX_CLOUD_SET_METADATA_BYTES = 3 * 1024 * 1024;
export const MAX_CLOUD_SET_ASSET_BYTES = 8 * 1024 * 1024;
export const MAX_CLOUD_SET_ASSETS = 256;

export const CLOUD_SET_ASSET_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export type CloudSetAssetMimeType = typeof CLOUD_SET_ASSET_MIME_TYPES[number];

export interface CloudSetAssetDescriptor {
  id: string;
  mimeType: CloudSetAssetMimeType;
  size: number;
}

export interface CloudSetSummary {
  setId: string;
  name: string;
  revision: number;
  cardCount: number;
  storageBytes: number;
  metadataBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudSetListResult {
  sets: CloudSetSummary[];
  limit: number;
  used: number;
}

export interface CloudSetPreparedUpload extends CloudSetAssetDescriptor {
  signedUrl: string;
}

export interface CloudSetPrepareResult {
  setId: string;
  metadataBytes: number;
  storageBytes: number;
  uploads: CloudSetPreparedUpload[];
}

export interface CloudSetDownloadAsset extends CloudSetAssetDescriptor {
  signedUrl: string;
}

export interface CloudSetDownloadResult {
  summary: CloudSetSummary;
  payload: CardForgeTransferV1;
  assets: CloudSetDownloadAsset[];
}

export const isCloudSetAssetMimeType = (value: string): value is CloudSetAssetMimeType => (
  (CLOUD_SET_ASSET_MIME_TYPES as readonly string[]).includes(value)
);

export const isCloudSetAssetId = (value: string): boolean => /^[a-f0-9]{64}$/u.test(value);

export const getCloudSetAssetReference = (assetId: string): string => (
  `${CLOUD_SET_ASSET_REFERENCE_PREFIX}${assetId}`
);

export const getCloudSetAssetIdFromReference = (value: string): string | null => {
  if (!value.startsWith(CLOUD_SET_ASSET_REFERENCE_PREFIX)) return null;
  const assetId = value.slice(CLOUD_SET_ASSET_REFERENCE_PREFIX.length);
  return isCloudSetAssetId(assetId) ? assetId : null;
};
