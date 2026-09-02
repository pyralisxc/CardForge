export const PIPELINE_STORAGE_BUCKET = 'cardforge-contributor-assets';

export const DEFAULT_PIPELINE_UPLOAD_MAX_MB = 25;
export const PIPELINE_UPLOAD_HARD_MAX_MB = 50;

export const getPipelineUploadMaxBytes = (maxFileSizeMb: number): number => (
  Math.min(
    PIPELINE_UPLOAD_HARD_MAX_MB,
    Math.max(1, Math.round(maxFileSizeMb)),
  ) * 1024 * 1024
);

export interface PipelineUploadPlan {
  signedUrl: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  maxFileSizeBytes: number;
}

export interface PipelineUploadedFile {
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

export const PIPELINE_UPLOAD_ALLOWED_MIME_TYPES = [
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
  'application/vnd.cardforge.project+zip',
] as const;
