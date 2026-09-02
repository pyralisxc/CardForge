"use client";

import type { ProjectDocumentV1 } from '@/features/project/client/package-document';
import {
  replaceStudioDocumentAssetReferences,
  type StudioDocumentAssetDownload,
} from '../assetReferences';

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('Private CardForge artwork could not be decoded.'));
  reader.onerror = () => reject(reader.error ?? new Error('Private CardForge artwork could not be decoded.'));
  reader.readAsDataURL(blob);
});

export const hydrateStudioDocumentAssetValue = async <Value>(
  value: Value,
  assets: StudioDocumentAssetDownload[],
): Promise<Value> => {
  const replacements = new Map<string, string>();
  for (let start = 0; start < assets.length; start += 4) {
    const hydrated = await Promise.all(assets.slice(start, start + 4).map(async (asset) => {
      const response = await fetch(asset.signedUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('CardForge could not download one of this document’s private artwork files.');
      const blob = await response.blob();
      if (blob.type && blob.type !== asset.mimeType) {
        throw new Error('One of this document’s private artwork files has an unexpected format.');
      }
      return [asset.id, await blobToDataUrl(blob)] as const;
    }));
    hydrated.forEach(([id, dataUrl]) => replacements.set(id, dataUrl));
  }
  return replaceStudioDocumentAssetReferences(value, replacements) as Value;
};

export const hydrateStudioDocumentAssets = (
  document: ProjectDocumentV1,
  assets: StudioDocumentAssetDownload[],
): Promise<ProjectDocumentV1> => hydrateStudioDocumentAssetValue(document, assets);
