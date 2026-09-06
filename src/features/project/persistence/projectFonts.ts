"use client";

import type { CardFontOption } from '@/domain/rendering';
import {
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
} from '../model/projectDocument';
import {
  MAX_PROJECT_FONTS,
  PROJECT_FONT_LIBRARY_CHANGE_EVENT,
  normalizeProjectFontAssets,
  type ProjectFontAsset,
} from '../model/projectFont';
import {
  getProjectAssetStorage,
  readTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from './projectAssets';

export const readProjectFonts = async (): Promise<ProjectFontAsset[]> => (
  normalizeProjectFontAssets(await readTypedProjectAssetListFromStorage<ProjectFontAsset>(
    getProjectAssetStorage(),
    CUSTOM_FONT_ASSETS_STORAGE_KEY,
  ))
);

const notifyProjectFontsChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROJECT_FONT_LIBRARY_CHANGE_EVENT));
};

export const writeProjectFonts = async (fonts: ProjectFontAsset[]): Promise<ProjectFontAsset[]> => {
  const normalized = normalizeProjectFontAssets(fonts);
  if (normalized.length > MAX_PROJECT_FONTS) throw new Error(`A CardForge project can use at most ${MAX_PROJECT_FONTS} personal fonts.`);
  await writeProjectAssetListToStorage(getProjectAssetStorage(), CUSTOM_FONT_ASSETS_STORAGE_KEY, normalized);
  notifyProjectFontsChanged();
  return normalized;
};

export const upsertProjectFont = async (font: ProjectFontAsset): Promise<ProjectFontAsset> => {
  const current = await readProjectFonts();
  const next = current.some((candidate) => candidate.id === font.id)
    ? current.map((candidate) => candidate.id === font.id ? font : candidate)
    : [...current, font];
  await writeProjectFonts(next);
  return font;
};

export const removeProjectFont = async (fontId: string): Promise<void> => {
  const current = await readProjectFonts();
  await writeProjectFonts(current.filter((font) => font.id !== fontId));
};

export const mapProjectFontsToCardFontOptions = (fonts: ProjectFontAsset[]): CardFontOption[] => (
  normalizeProjectFontAssets(fonts).map((font) => ({
    name: `${font.name} · My Library`,
    value: font.value,
    category: 'Utility',
    cssFamily: `"${font.value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}", sans-serif`,
    sourceUrl: font.dataUrl,
    sourceMimeType: font.mimeType,
  }))
);
