import type { AuthoredArtifact } from '@/domain/artifacts';
import type { CardSet } from '@/domain/cards';

import type { ProjectDocumentV1 } from './projectDocument';
export type { ProjectDocumentV1 } from './projectDocument';

export const CARDFORGE_PROJECT_PACKAGE_VERSION = 5 as const;
export const SET_OWNERSHIP_CARDFORGE_PROJECT_PACKAGE_VERSION = 4 as const;
export const CONTEXT_CARDFORGE_PROJECT_PACKAGE_VERSION = 3 as const;
export const ARTIFACT_CARDFORGE_PROJECT_PACKAGE_VERSION = 2 as const;
export const LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION = 1 as const;
export const CARDFORGE_PROJECT_FILE_EXTENSION = '.cardforge';
export const CARDFORGE_PROJECT_MANIFEST_FILE = 'cardforge-project.json';
export const CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX = 'cardforge-project-asset://';

// These are safety ceilings for one portable package crossing a browser/server boundary.
// A local workspace itself is not quota-limited by these values.
export const MAX_PROJECT_PACKAGE_BYTES = 256 * 1024 * 1024;
export const MAX_PROJECT_PACKAGE_METADATA_BYTES = 8 * 1024 * 1024;
export const MAX_PROJECT_PACKAGE_ASSET_BYTES = 32 * 1024 * 1024;
export const MAX_PROJECT_PACKAGE_ASSETS = 4096;

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

/**
 * A reusable package asset source whose bytes are loaded only for the current
 * ZIP entry. Browser-backed snapshots use this instead of retaining every
 * IndexedDB Blob as a Uint8Array for the lifetime of the package build.
 */
export interface ProjectPackageLazyAssetSource {
  kind: 'lazy';
  size: number;
  load: () => Promise<Uint8Array>;
}

export type ProjectPackageAssetSource = Uint8Array | ProjectPackageLazyAssetSource;

export type ResolvedProjectPackageAssetReference = {
  mimeType: string;
  bytes: Uint8Array;
} | {
  mimeType: string;
  source: ProjectPackageLazyAssetSource;
};

export interface CardForgeProjectManifestV1 {
  cardforgeProject: typeof LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION;
  name: string;
  projectRevision: string;
  savedAt: string;
  project: Omit<ProjectDocumentV1, 'version' | 'cardSets'> & {
    version: 1 | 2;
    cardSets: Array<Omit<CardSet, 'updateReviews'>>;
  };
  assets: ProjectPackageAssetDescriptor[];
}

/**
 * The portable v2 document makes authored objects explicit. ProjectDocumentV1
 * remains the runtime compatibility boundary while Cards are the only shipped
 * Artifact type.
 */
export interface PortableProjectDocumentV2 extends Omit<ProjectDocumentV1, 'version' | 'storedCards' | 'cardSets'> {
  version: 2;
  cardSets: Array<Omit<CardSet, 'updateReviews'>>;
  artifacts: AuthoredArtifact[];
}

export interface CardForgeProjectManifestV2 {
  cardforgeProject: typeof ARTIFACT_CARDFORGE_PROJECT_PACKAGE_VERSION;
  name: string;
  projectRevision: string;
  savedAt: string;
  project: PortableProjectDocumentV2;
  assets: ProjectPackageAssetDescriptor[];
}

export interface CardForgeProjectManifestV3 extends Omit<CardForgeProjectManifestV2, 'cardforgeProject'> {
  cardforgeProject: typeof CONTEXT_CARDFORGE_PROJECT_PACKAGE_VERSION;
}

export interface PortableProjectDocumentV3 extends Omit<PortableProjectDocumentV2, 'version'> {
  version: 3;
}

export interface CardForgeProjectManifestV4 extends Omit<CardForgeProjectManifestV3, 'cardforgeProject' | 'project'> {
  cardforgeProject: typeof SET_OWNERSHIP_CARDFORGE_PROJECT_PACKAGE_VERSION;
  project: PortableProjectDocumentV3;
}

export interface PortableProjectDocumentV4 extends Omit<PortableProjectDocumentV3, 'version' | 'cardSets'> {
  version: 4;
  cardSets: CardSet[];
}

export interface CardForgeProjectManifestV5 extends Omit<CardForgeProjectManifestV4, 'cardforgeProject' | 'project'> {
  cardforgeProject: typeof CARDFORGE_PROJECT_PACKAGE_VERSION;
  project: PortableProjectDocumentV4;
}

export type CardForgeProjectManifest =
  | CardForgeProjectManifestV1
  | CardForgeProjectManifestV2
  | CardForgeProjectManifestV3
  | CardForgeProjectManifestV4
  | CardForgeProjectManifestV5;

export interface CardForgeProjectPackageSnapshot {
  manifest: CardForgeProjectManifest;
  assets: ReadonlyMap<string, ProjectPackageAssetSource>;
}

export interface CardForgeProjectPackageSnapshotV2 extends CardForgeProjectPackageSnapshot {
  manifest: CardForgeProjectManifestV2;
}

export interface CardForgeProjectPackageSnapshotV3 extends CardForgeProjectPackageSnapshot {
  manifest: CardForgeProjectManifestV3;
}

export interface CardForgeProjectPackageSnapshotV4 extends CardForgeProjectPackageSnapshot {
  manifest: CardForgeProjectManifestV4;
}

export interface CardForgeProjectPackageSnapshotV5 extends CardForgeProjectPackageSnapshot {
  manifest: CardForgeProjectManifestV5;
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
