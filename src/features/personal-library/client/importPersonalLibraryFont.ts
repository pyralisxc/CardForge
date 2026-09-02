"use client";

import { MAX_PROJECT_FONT_BYTES, getProjectFontValue, isProjectFontMimeType, upsertProjectFont, type ProjectFontAsset } from '@/features/project/client/assets';
import { materializePersonalLibraryItemContent } from './personalLibraryClient';
import type { PersonalLibraryItem } from '../model';

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('CardForge could not read the selected font.'));
  reader.onerror = () => reject(reader.error ?? new Error('CardForge could not read the selected font.'));
  reader.readAsDataURL(blob);
});

const validateBrowserFont = async (family: string, blob: Blob): Promise<void> => {
  if (typeof FontFace === 'undefined') return;
  const bytes = await blob.arrayBuffer();
  const face = new FontFace(family, bytes);
  try {
    await face.load();
  } catch {
    throw new Error('The selected file could not be loaded as a browser font. Choose a valid WOFF2, WOFF, TTF, or OTF font file.');
  }
};

export const importPersonalLibraryFont = async (
  item: PersonalLibraryItem,
): Promise<ProjectFontAsset> => {
  if (item.role !== 'font') throw new Error('Choose a personal-library item indexed as a font.');
  if (!isProjectFontMimeType(item.mimeType)) throw new Error('That connected item is not a supported CardForge font format.');
  if (item.byteSize <= 0 || item.byteSize > MAX_PROJECT_FONT_BYTES) {
    throw new Error(`Personal project fonts must be ${Math.round(MAX_PROJECT_FONT_BYTES / 1024 / 1024)} MB or smaller.`);
  }

  const materialized = await materializePersonalLibraryItemContent(item);
  const mimeType = materialized.mimeType.toLowerCase();
  if (!isProjectFontMimeType(mimeType)) throw new Error('Google Drive returned an unsupported font format for this item.');
  if (materialized.blob.size <= 0 || materialized.blob.size > MAX_PROJECT_FONT_BYTES) {
    throw new Error(`Personal project fonts must be ${Math.round(MAX_PROJECT_FONT_BYTES / 1024 / 1024)} MB or smaller.`);
  }

  const id = materialized.contentHash || `drive:${item.id}`;
  const value = getProjectFontValue(id);
  await validateBrowserFont(value, materialized.blob);
  const font: ProjectFontAsset = {
    id,
    name: item.displayName.replace(/\.(woff2?|ttf|otf)$/iu, '') || 'Personal Font',
    value,
    mimeType,
    dataUrl: await blobToDataUrl(materialized.blob),
    fileSizeBytes: materialized.blob.size,
    sourceProvider: 'google-drive',
    sourceItemId: item.id,
    sourceProviderFileId: item.providerFileId,
    sourceProviderRevision: item.providerRevision,
  };
  await upsertProjectFont(font);
  return font;
};
