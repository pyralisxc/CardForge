"use client";

import type { ProjectDocumentV1 } from '@/features/project/client/package-document';
import { isProjectFontMimeType, MAX_PROJECT_FONT_BYTES } from '@/features/project/client/assets';
import {
  replaceStudioDocumentAssetReferences,
  collectStudioDocumentAssetIds, collectStudioDocumentFontIds,
  STUDIO_DOCUMENT_ASSET_REFERENCE_PREFIX, STUDIO_DOCUMENT_FONT_REFERENCE_PREFIX,
  MAX_STUDIO_DOCUMENT_ASSETS, MAX_STUDIO_DOCUMENT_FONTS, MAX_STUDIO_DOCUMENT_ASSET_STORAGE_BYTES,
  getStudioDocumentAssetIdFromReference, getStudioDocumentFontIdFromReference,
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
  signal?: AbortSignal,
  verifyIntegrity = false,
): Promise<Value> => {
  signal?.throwIfAborted();
  if (verifyIntegrity) {
    const validateReferences = (entry: unknown): void => {
      if (typeof entry === 'string') {
        if ((entry.startsWith(STUDIO_DOCUMENT_ASSET_REFERENCE_PREFIX) && !getStudioDocumentAssetIdFromReference(entry)) || (entry.startsWith(STUDIO_DOCUMENT_FONT_REFERENCE_PREFIX) && !getStudioDocumentFontIdFromReference(entry))) throw new Error('A private asset reference is invalid.');
      } else if (Array.isArray(entry)) entry.forEach(validateReferences);
      else if (entry && typeof entry === 'object') Object.values(entry).forEach(validateReferences);
    };
    validateReferences(value);
    const images = new Set(collectStudioDocumentAssetIds(value));
    const fonts = new Set(collectStudioDocumentFontIds(value));
    const expected = new Set([...images, ...fonts]);
    if (expected.size !== images.size + fonts.size || assets.some((asset) => !asset || typeof asset.id !== 'string' || typeof asset.signedUrl !== 'string' || !asset.signedUrl || (asset.kind !== 'image' && asset.kind !== 'font') || (asset.kind === 'image' ? !images.has(asset.id) : !fonts.has(asset.id)))) throw new Error('The private asset list is invalid or ambiguous.');
    const observed = new Set(assets.map((asset) => asset.id));
    if (observed.size !== assets.length || observed.size !== expected.size || [...expected].some((id) => !observed.has(id))) throw new Error('The private asset list is incomplete or ambiguous.');
    if (images.size > MAX_STUDIO_DOCUMENT_ASSETS || fonts.size > MAX_STUDIO_DOCUMENT_FONTS || assets.some((asset) => !Number.isSafeInteger(asset.size) || asset.size === null || asset.size < 1 || (asset.kind === 'font' && (asset.size > MAX_PROJECT_FONT_BYTES || !isProjectFontMimeType(asset.mimeType))) || (asset.kind === 'image' && asset.mimeType !== 'image/webp')) || assets.reduce((sum, asset) => sum + (asset.size ?? 0), 0) > MAX_STUDIO_DOCUMENT_ASSET_STORAGE_BYTES) throw new Error('The private asset sizes or formats are invalid.');
  }
  const replacements = new Map<string, string>();
  for (let start = 0; start < assets.length; start += 4) {
    const hydrated = await Promise.all(assets.slice(start, start + 4).map(async (asset) => {
      const response = await fetch(asset.signedUrl, { cache: 'no-store', signal });
      if (!response.ok) throw new Error('CardForge could not download one of this document’s private artwork files.');
      const blob = await response.blob();
      if (verifyIntegrity) {
        if (!Number.isSafeInteger(asset.size) || asset.size === null || asset.size < 1 || blob.size !== asset.size) throw new Error('A private asset has an unexpected byte length.');
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        if (digest !== asset.id) throw new Error('A private asset does not match its recorded digest.');
      }
      if (blob.type && blob.type !== asset.mimeType) {
        throw new Error('One of this document’s private artwork files has an unexpected format.');
      }
      return [asset.id, await blobToDataUrl(verifyIntegrity && !blob.type ? new Blob([blob], { type: asset.mimeType }) : blob)] as const;
    }));
    hydrated.forEach(([id, dataUrl]) => replacements.set(id, dataUrl));
  }
  signal?.throwIfAborted();
  return replaceStudioDocumentAssetReferences(value, replacements) as Value;
};

export const hydrateStudioDocumentAssets = (
  document: ProjectDocumentV1,
  assets: StudioDocumentAssetDownload[],
  signal?: AbortSignal,
  verifyIntegrity = false,
): Promise<ProjectDocumentV1> => hydrateStudioDocumentAssetValue(document, assets, signal, verifyIntegrity);
