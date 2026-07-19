export const DEVELOPER_ASSET_STORAGE_BUCKET = 'cardforge-developer-assets';

// This is a CardForge per-file product limit, not the Supabase plan's total
// storage quota. Raise it intentionally alongside a Storage bucket migration.
export const DEVELOPER_ASSET_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

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
