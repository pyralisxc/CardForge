export const DEVELOPER_ASSET_STORAGE_BUCKET = 'cardforge-developer-assets';

export const DEFAULT_DEVELOPER_ASSET_UPLOAD_MAX_MB = 25;
export const DEVELOPER_ASSET_UPLOAD_HARD_MAX_MB = 50;

export const getDeveloperAssetUploadMaxBytes = (maxFileSizeMb: number): number => (
  Math.min(
    DEVELOPER_ASSET_UPLOAD_HARD_MAX_MB,
    Math.max(1, Math.round(maxFileSizeMb)),
  ) * 1024 * 1024
);

export interface DeveloperAssetUploadPlan {
  signedUrl: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  maxFileSizeBytes: number;
}

export interface DeveloperAssetUploadedFile {
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

export const DEVELOPER_ASSET_UPLOAD_ALLOWED_MIME_TYPES = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/json',
  'font/woff2',
  'font/woff',
  'font/ttf',
  'font/otf',
  'application/font-woff',
  'application/x-font-ttf',
  'application/x-font-otf',
  'application/octet-stream',
] as const;
