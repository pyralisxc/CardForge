"use client";

import {
  buildCardForgeProjectSnapshot,
  decodeCardForgeProjectPackage,
  decodeProjectFile,
  type DecodedProjectFile,
} from '../lib/projectPackageCodec';
import { referenceCardForgeProjectSnapshotAssets } from '../lib/projectPackageAssetReferences';
import { CARDFORGE_PROJECT_FILE_EXTENSION } from '../model/projectPackage';
import {
  getBrowserProjectAssetReference,
  readBrowserProjectAssetSource,
  storeBrowserProjectAssetBytes,
} from '../persistence/contentAddressedBrowserAssets';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';

export const materializeBrowserProjectSnapshot = async (
  snapshot: Awaited<ReturnType<typeof decodeCardForgeProjectPackage>>,
): Promise<DecodedProjectFile['document']> => {
  const scope = getProjectPersistenceScope();
  if (scope === 'unscoped-disabled') {
    throw new Error('CardForge cannot import project artwork before the browser workspace owner is known.');
  }
  for (const descriptor of snapshot.manifest.assets) {
    const source = snapshot.assets.get(descriptor.id);
    if (!source) throw new Error(`This project is missing required asset ${descriptor.id.slice(0, 12)}….`);
    const bytes = source instanceof Uint8Array ? source : await source.load();
    await storeBrowserProjectAssetBytes({
      scope,
      assetId: descriptor.id,
      mimeType: descriptor.mimeType,
      bytes,
    });
  }
  return referenceCardForgeProjectSnapshotAssets(
    snapshot,
    (descriptor) => getBrowserProjectAssetReference(descriptor.id),
  );
};

export const decodeBrowserProjectFile = async (file: File): Promise<DecodedProjectFile> => {
  if (!file.name.toLowerCase().endsWith(CARDFORGE_PROJECT_FILE_EXTENSION)) {
    return decodeProjectFile(file);
  }
  const snapshot = await decodeCardForgeProjectPackage(file);
  return {
    document: await materializeBrowserProjectSnapshot(snapshot),
    name: snapshot.manifest.name,
    sourceRevision: snapshot.manifest.projectRevision,
    format: 'cardforge-package',
  };
};

export const buildBrowserCardForgeProjectSnapshot = async (
  options: Omit<Parameters<typeof buildCardForgeProjectSnapshot>[0], 'resolveAssetReference'>,
) => {
  const scope = getProjectPersistenceScope();
  if (scope === 'unscoped-disabled') {
    throw new Error('CardForge cannot package browser artwork before the workspace owner is known.');
  }
  return buildCardForgeProjectSnapshot({
    ...options,
    resolveAssetReference: (reference) => readBrowserProjectAssetSource(reference, scope),
  });
};
