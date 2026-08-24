import { getProjectPackageAssetIdFromReference } from './projectPackage';

export const PROJECT_FONT_MIME_TYPES = [
  'font/woff2',
  'font/woff',
  'font/ttf',
  'font/otf',
  'application/font-woff',
  'application/x-font-ttf',
  'application/x-font-opentype',
] as const;

export type ProjectFontMimeType = typeof PROJECT_FONT_MIME_TYPES[number];

export const MAX_PROJECT_FONT_BYTES = 16 * 1024 * 1024;
export const MAX_PROJECT_FONTS = 64;
export const PROJECT_FONT_LIBRARY_CHANGE_EVENT = 'cardforge-project-font-library-change';

export interface ProjectFontAsset {
  id: string;
  name: string;
  value: string;
  mimeType: ProjectFontMimeType;
  dataUrl: string;
  fileSizeBytes: number;
  sourceProvider?: 'google-drive';
  sourceItemId?: string;
  sourceProviderFileId?: string;
  sourceProviderRevision?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const isProjectFontMimeType = (value: string): value is ProjectFontMimeType => (
  (PROJECT_FONT_MIME_TYPES as readonly string[]).includes(value.toLowerCase())
);

export const isProjectFontAssetId = (value: string): boolean => /^[a-zA-Z0-9:_-]{8,180}$/u.test(value);

export const getProjectFontValue = (assetId: string): string => (
  `font-personal-${assetId.toLowerCase().replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 80) || 'custom'}`
);

const normalizeDataUrlMime = (dataUrl: string): string | null => {
  const match = /^data:([^;,]+);base64,/iu.exec(dataUrl);
  return match?.[1]?.toLowerCase() ?? null;
};

const isPortableProjectAssetReference = (value: string): boolean => (
  getProjectPackageAssetIdFromReference(value) !== null
);

export const normalizeProjectFontAsset = (value: unknown): ProjectFontAsset | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 160) : '';
  const mimeType = typeof value.mimeType === 'string' ? value.mimeType.toLowerCase() : '';
  const dataUrl = typeof value.dataUrl === 'string' ? value.dataUrl : '';
  const fileSizeBytes = typeof value.fileSizeBytes === 'number' ? value.fileSizeBytes : Number.NaN;
  if (!isProjectFontAssetId(id) || !name || !isProjectFontMimeType(mimeType)) return null;
  if (!Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > MAX_PROJECT_FONT_BYTES) return null;
  if (!isPortableProjectAssetReference(dataUrl) && normalizeDataUrlMime(dataUrl) !== mimeType) return null;
  const sourceProvider = value.sourceProvider === 'google-drive' ? 'google-drive' : undefined;
  const optionalString = (input: unknown, max: number) => (
    typeof input === 'string' && input.trim() ? input.trim().slice(0, max) : undefined
  );
  return {
    id,
    name,
    value: getProjectFontValue(id),
    mimeType,
    dataUrl,
    fileSizeBytes,
    ...(sourceProvider ? { sourceProvider } : {}),
    ...(optionalString(value.sourceItemId, 180) ? { sourceItemId: optionalString(value.sourceItemId, 180) } : {}),
    ...(optionalString(value.sourceProviderFileId, 255) ? { sourceProviderFileId: optionalString(value.sourceProviderFileId, 255) } : {}),
    ...(optionalString(value.sourceProviderRevision, 80) ? { sourceProviderRevision: optionalString(value.sourceProviderRevision, 80) } : {}),
  };
};

export const normalizeProjectFontAssets = (value: unknown): ProjectFontAsset[] => {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, ProjectFontAsset>();
  for (const entry of value.slice(0, MAX_PROJECT_FONTS)) {
    const font = normalizeProjectFontAsset(entry);
    if (font) byId.set(font.id, font);
  }
  return [...byId.values()];
};
