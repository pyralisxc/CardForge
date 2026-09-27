"use client";

import { createCardForgeProjectPackageBlob } from '../lib/projectPackageCodec';
import type { LocalLibraryResource } from '../model/localLibraryResources';
import { isProjectBinaryAssetReference } from '../persistence/projectBinaryAssetResolver';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { readBrowserProjectAssetReference } from '../persistence/contentAddressedBrowserAssets';
import { useProjectStore } from '../store/workspaceStore';
import { buildBrowserCardForgeProjectSnapshot } from './browserProjectPackage';
import { readLocalLibraryResources } from './localLibraryResources';
import { captureCardSetProjectDocument } from './projectWorkspaceDocument';

export type PortableProjectAssetCollection = 'texture' | 'divider' | 'icon' | 'image';
export type PortableProjectAsset = LocalLibraryResource & { collection: PortableProjectAssetCollection };

const extensionForMimeType = (mimeType: string): string => {
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'bin';
};

const extensionForSource = (source: string): string => {
  if (source.startsWith('data:')) {
    const mimeType = source.match(/^data:([^;,]+)/)?.[1] ?? '';
    return extensionForMimeType(mimeType);
  }
  const extension = source.split('?')[0]?.split('.').pop()?.toLowerCase();
  return extension && ['svg', 'png', 'jpg', 'jpeg', 'webp'].includes(extension) ? extension : 'asset';
};

export const usePortableProjectSets = () => useProjectStore((state) => state.cardSets);

export const readPortableProjectAssets = async (): Promise<PortableProjectAsset[]> => {
  const result = await readLocalLibraryResources();
  const relevantFailure = result.failures.find((failure) => failure.collection !== 'font');
  if (relevantFailure) throw relevantFailure.error;
  return result.resources.filter((resource): resource is PortableProjectAsset => (
    resource.collection === 'texture'
    || resource.collection === 'divider'
    || resource.collection === 'icon'
    || resource.collection === 'image'
  ));
};

export const materializePortableProjectAssetFile = async (
  asset: PortableProjectAsset,
  fileNameStem: string,
): Promise<File> => {
  if (asset.status !== 'available' || !asset.source) throw new Error(`Unable to read ${asset.name}.`);
  if (isProjectBinaryAssetReference(asset.source)) {
    const resolved = await readBrowserProjectAssetReference(asset.source, getProjectPersistenceScope());
    if (!resolved) throw new Error(`Unable to read ${asset.name}.`);
    const bytes = Uint8Array.from(resolved.bytes);
    return new File(
      [bytes.buffer],
      `${fileNameStem}.${extensionForMimeType(resolved.mimeType)}`,
      { type: resolved.mimeType },
    );
  }

  const response = await fetch(asset.source);
  if (!response.ok) throw new Error(`Unable to read ${asset.name}.`);
  const blob = await response.blob();
  const mimeType = blob.type || (asset.source.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'application/octet-stream');
  const extension = mimeType === 'application/octet-stream' ? extensionForSource(asset.source) : extensionForMimeType(mimeType);
  return new File([blob], `${fileNameStem}.${extension}`, { type: mimeType });
};

export const materializePortableCardSetFile = async ({
  setId,
  name,
  fileName,
}: {
  setId: string;
  name: string;
  fileName: string;
}): Promise<File> => {
  const document = await captureCardSetProjectDocument(setId);
  const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name });
  const blob = await createCardForgeProjectPackageBlob(snapshot);
  return new File([blob], fileName, { type: 'application/vnd.cardforge.project+zip' });
};
