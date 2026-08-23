import type { ProjectDocumentV1 } from './projectDocument';
export type { ProjectDocumentV1 } from './projectDocument';

export const CARDFORGE_PROJECT_PACKAGE_VERSION = 1 as const;
export const CARDFORGE_PROJECT_FILE_EXTENSION = '.cardforge';
export const CARDFORGE_PROJECT_MANIFEST_FILE = 'cardforge-project.json';
export const CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX = 'cardforge-project-asset://';

// These are safety ceilings for one portable package crossing a browser/server boundary.
// A local workspace itself is not quota-limited by these values.
export const MAX_PROJECT_PACKAGE_BYTES = 256 * 1024 * 1024;
export const MAX_PROJECT_PACKAGE_METADATA_BYTES = 8 * 1024 * 1024;
export const MAX_PROJECT_PACKAGE_ASSET_BYTES = 32 * 1024 * 1024;
export const MAX_PROJECT_PACKAGE_ASSETS = 512;

export const PROJECT_PACKAGE_ASSET_MIME_TYPES = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
  'font/woff2',
  'font/woff',
  'font/ttf',
  'font/otf',
  'application/font-woff',
  'application/x-font-ttf',
  'application/x-font-opentype',
] as const;

export type ProjectPackageAssetMimeType = typeof PROJECT_PACKAGE_ASSET_MIME_TYPES[number];

export interface ProjectPackageAssetDescriptor {
  id: string;
  mimeType: ProjectPackageAssetMimeType;
  size: number;
  path: string;
}

export interface CardForgeProjectManifestV1 {
  cardforgeProject: typeof CARDFORGE_PROJECT_PACKAGE_VERSION;
  name: string;
  projectRevision: string;
  savedAt: string;
  project: ProjectDocumentV1;
  assets: ProjectPackageAssetDescriptor[];
}

export interface CardForgeProjectPackageSnapshot {
  manifest: CardForgeProjectManifestV1;
  assets: ReadonlyMap<string, Uint8Array>;
}

export type ProjectSourceProvider = 'browser' | 'local-folder' | 'google-drive';

export interface ProjectSourceDescriptor {
  provider: ProjectSourceProvider;
  displayName: string;
  externalId: string | null;
  sourceRevision: string | null;
  lastSavedAt: string | null;
  serverReachable: boolean;
}

export const isProjectPackageAssetMimeType = (value: string): value is ProjectPackageAssetMimeType => (
  (PROJECT_PACKAGE_ASSET_MIME_TYPES as readonly string[]).includes(value)
);

export const isProjectPackageAssetId = (value: string): boolean => /^[a-f0-9]{64}$/u.test(value);

export const getProjectPackageAssetReference = (assetId: string): string => (
  `${CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX}${assetId}`
);

export const getProjectPackageAssetIdFromReference = (value: string): string | null => {
  if (!value.startsWith(CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX)) return null;
  const assetId = value.slice(CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX.length);
  return isProjectPackageAssetId(assetId) ? assetId : null;
};

export const getProjectPackageAssetExtension = (mimeType: ProjectPackageAssetMimeType): string => {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'image/svg+xml': return 'svg';
    case 'font/woff2': return 'woff2';
    case 'font/woff':
    case 'application/font-woff': return 'woff';
    case 'font/ttf':
    case 'application/x-font-ttf': return 'ttf';
    case 'font/otf':
    case 'application/x-font-opentype': return 'otf';
  }
};

export const normalizeProjectFileName = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]+/gu, '-')
    .replace(/\s+/gu, ' ')
    .replace(/[. ]+$/gu, '')
    .slice(0, 120);
  return cleaned || 'CardForge Project';
};
