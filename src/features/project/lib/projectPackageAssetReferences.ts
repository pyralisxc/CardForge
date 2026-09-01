import { getCardFromArtifact } from '@/domain/artifacts';

import {
  getProjectPackageAssetIdFromReference,
  LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION,
  type CardForgeProjectPackageSnapshot,
  type PortableProjectDocumentV2,
  type ProjectPackageAssetDescriptor,
} from '../model/projectPackage';
import { parseProjectDocumentValue, type ProjectDocumentV1 } from '../model/projectDocument';
import { ProjectPackageError } from './projectPackageCodec';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const referenceProjectAssets = (
  value: unknown,
  descriptors: ReadonlyMap<string, ProjectPackageAssetDescriptor>,
  assets: ReadonlyMap<string, Uint8Array>,
  getRuntimeReference: (descriptor: ProjectPackageAssetDescriptor) => string,
  depth = 0,
): unknown => {
  if (depth > 80) throw new ProjectPackageError('This project is nested too deeply to open safely.');
  if (typeof value === 'string') {
    const id = getProjectPackageAssetIdFromReference(value);
    if (!id) return value;
    const descriptor = descriptors.get(id);
    if (!descriptor || !assets.has(id)) {
      throw new ProjectPackageError(`This project is missing required asset ${id.slice(0, 12)}….`);
    }
    return getRuntimeReference(descriptor);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => referenceProjectAssets(entry, descriptors, assets, getRuntimeReference, depth + 1));
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => (
      [key, referenceProjectAssets(entry, descriptors, assets, getRuntimeReference, depth + 1)]
    )));
  }
  return value;
};

export const referenceCardForgeProjectSnapshotAssets = (
  snapshot: CardForgeProjectPackageSnapshot,
  getRuntimeReference: (descriptor: ProjectPackageAssetDescriptor) => string,
): ProjectDocumentV1 => {
  const descriptors = new Map(snapshot.manifest.assets.map((asset) => [asset.id, asset]));
  const referenced = referenceProjectAssets(snapshot.manifest.project, descriptors, snapshot.assets, getRuntimeReference);
  const runtime = snapshot.manifest.cardforgeProject === LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION
    ? referenced
    : {
        ...(referenced as PortableProjectDocumentV2),
        version: 1,
        storedCards: (referenced as PortableProjectDocumentV2).artifacts.map(getCardFromArtifact),
      };
  const parsed = parseProjectDocumentValue(runtime);
  if (!parsed.success) throw new ProjectPackageError(parsed.error);
  return parsed.document;
};
