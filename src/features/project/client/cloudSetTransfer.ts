"use client";

import type { CardForgeTransferV1 } from '../model/cardTransfer';
import {
  getCloudSetAssetIdFromReference,
  getCloudSetAssetReference,
  isCloudSetAssetMimeType,
  MAX_CLOUD_SET_ASSET_BYTES,
  MAX_CLOUD_SET_ASSETS,
  MAX_CLOUD_SET_BYTES,
  MAX_CLOUD_SET_METADATA_BYTES,
  type CloudSetAssetDescriptor,
  type CloudSetDownloadAsset,
  type CloudSetPreparedUpload,
} from '../model/cloudSet';

export interface PreparedCloudSetAsset extends CloudSetAssetDescriptor {
  blob: Blob;
}

export interface PreparedCloudSetTransfer {
  payload: CardForgeTransferV1;
  assets: PreparedCloudSetAsset[];
  metadataBytes: number;
  storageBytes: number;
}

const getByteLength = (value: string) => new TextEncoder().encode(value).length;

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('Cloud artwork could not be decoded.'));
  reader.onerror = () => reject(reader.error ?? new Error('Cloud artwork could not be decoded.'));
  reader.readAsDataURL(blob);
});

const hashBlob = async (blob: Blob): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot securely fingerprint artwork for cloud saving.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const dataUriToAsset = async (value: string): Promise<PreparedCloudSetAsset | null> => {
  if (!value.startsWith('data:image/')) return null;
  const commaIndex = value.indexOf(',');
  if (commaIndex < 0 || !value.slice(0, commaIndex).includes(';base64')) return null;
  const mimeType = value.slice(5, value.indexOf(';', 5));
  if (!isCloudSetAssetMimeType(mimeType)) return null;
  const response = await fetch(value);
  const blob = await response.blob();
  if (blob.size <= 0 || blob.size > MAX_CLOUD_SET_ASSET_BYTES) {
    throw new Error(`Cloud artwork must be ${Math.round(MAX_CLOUD_SET_ASSET_BYTES / 1024 / 1024)} MB or smaller per image.`);
  }
  return {
    id: await hashBlob(blob),
    mimeType,
    size: blob.size,
    blob,
  };
};

export const prepareCloudSetTransfer = async (
  transfer: CardForgeTransferV1,
): Promise<PreparedCloudSetTransfer> => {
  const assets = new Map<string, PreparedCloudSetAsset>();
  const sourceCache = new Map<string, Promise<PreparedCloudSetAsset | null>>();

  const visit = async (value: unknown): Promise<unknown> => {
    if (typeof value === 'string') {
      let pending = sourceCache.get(value);
      if (!pending && value.startsWith('data:image/')) {
        pending = dataUriToAsset(value);
        sourceCache.set(value, pending);
      }
      const asset = pending ? await pending : null;
      if (!asset) return value;
      assets.set(asset.id, asset);
      if (assets.size > MAX_CLOUD_SET_ASSETS) {
        throw new Error(`A cloud set can contain at most ${MAX_CLOUD_SET_ASSETS} embedded artwork files.`);
      }
      return getCloudSetAssetReference(asset.id);
    }
    if (Array.isArray(value)) return Promise.all(value.map(visit));
    if (value && typeof value === 'object') {
      const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([key, entry]) => (
        [key, await visit(entry)] as const
      )));
      return Object.fromEntries(entries);
    }
    return value;
  };

  const payload = await visit(transfer) as CardForgeTransferV1;
  const metadataBytes = getByteLength(JSON.stringify(payload));
  if (metadataBytes > MAX_CLOUD_SET_METADATA_BYTES) {
    throw new Error('This set has too much non-artwork data for one cloud save. Split it into smaller sets or export it as a local CardForge file.');
  }
  const assetList = [...assets.values()];
  const storageBytes = metadataBytes + assetList.reduce((total, asset) => total + asset.size, 0);
  if (storageBytes > MAX_CLOUD_SET_BYTES) {
    throw new Error(`This set is larger than the ${Math.round(MAX_CLOUD_SET_BYTES / 1024 / 1024)} MB cloud-save limit. Local sets remain unlimited; reduce or reuse artwork before backing this set up.`);
  }
  return { payload, assets: assetList, metadataBytes, storageBytes };
};

const replaceCloudAssetReferences = (value: unknown, replacements: Map<string, string>): unknown => {
  if (typeof value === 'string') {
    const assetId = getCloudSetAssetIdFromReference(value);
    return assetId ? replacements.get(assetId) ?? value : value;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceCloudAssetReferences(entry, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => (
      [key, replaceCloudAssetReferences(entry, replacements)]
    )));
  }
  return value;
};

export const hydrateCloudSetTransfer = async (
  payload: CardForgeTransferV1,
  assets: CloudSetDownloadAsset[],
): Promise<CardForgeTransferV1> => {
  const replacements = new Map<string, string>();
  for (let start = 0; start < assets.length; start += 4) {
    const batch = assets.slice(start, start + 4);
    const hydrated = await Promise.all(batch.map(async (asset) => {
      const response = await fetch(asset.signedUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('CardForge could not download one of this set’s private cloud artwork files.');
      const blob = await response.blob();
      return [asset.id, await blobToDataUrl(blob)] as const;
    }));
    hydrated.forEach(([id, dataUrl]) => replacements.set(id, dataUrl));
  }
  return replaceCloudAssetReferences(payload, replacements) as CardForgeTransferV1;
};

export const uploadPreparedCloudSetAssets = async ({
  preparedAssets,
  uploads,
}: {
  preparedAssets: PreparedCloudSetAsset[];
  uploads: CloudSetPreparedUpload[];
}): Promise<void> => {
  const assetsById = new Map(preparedAssets.map((asset) => [asset.id, asset]));
  for (let start = 0; start < uploads.length; start += 4) {
    const batch = uploads.slice(start, start + 4);
    await Promise.all(batch.map(async (upload) => {
      const asset = assetsById.get(upload.id);
      if (!asset) throw new Error('CardForge lost track of an artwork file while preparing the cloud save.');
      const form = new FormData();
      form.append('cacheControl', '3600');
      form.append('', asset.blob);
      const response = await fetch(upload.signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'true' },
        body: form,
      });
      if (!response.ok) throw new Error('One of the set artwork files could not be uploaded to private cloud storage.');
    }));
  }
};
