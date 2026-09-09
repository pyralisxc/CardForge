"use client";

import type { CardFontOption } from '@/domain/rendering';
import {
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
} from '../model/projectDocument';
import {
  MAX_PROJECT_FONTS,
  PROJECT_FONT_LIBRARY_CHANGE_EVENT,
  normalizeProjectFontAsset,
  normalizeProjectFontAssets,
  type ProjectFontAsset,
} from '../model/projectFont';
import {
  getProjectAssetStorage,
  readTypedProjectAssetListFromStorage,
} from './projectAssets';
import { externalizeBrowserProjectAssetJson } from './contentAddressedBrowserAssets';
import { updateBrowserKeyValue } from './indexedDbStorage';
import { getProjectPersistenceScope, getScopedProjectStorageNamespace } from './projectPersistenceScope';

export const readProjectFonts = async (): Promise<ProjectFontAsset[]> => (
  requireReadableFonts(await readTypedProjectAssetListFromStorage<ProjectFontAsset>(
    getProjectAssetStorage(),
    CUSTOM_FONT_ASSETS_STORAGE_KEY,
  ))
);

const notifyProjectFontsChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROJECT_FONT_LIBRARY_CHANGE_EVENT));
};

const requireReadableFonts = (value: unknown): ProjectFontAsset[] => {
  if (!Array.isArray(value) || value.some((entry) => !normalizeProjectFontAsset(entry))) {
    throw new Error('The font library is unreadable. Its original data was left unchanged.');
  }
  if (value.length > MAX_PROJECT_FONTS) throw new Error(`A CardForge project can use at most ${MAX_PROJECT_FONTS} personal fonts.`);
  return normalizeProjectFontAssets(value);
};

const mutateProjectFonts = async (
  incoming: ProjectFontAsset[],
  update: (current: ProjectFontAsset[], prepared: ProjectFontAsset[]) => ProjectFontAsset[],
): Promise<ProjectFontAsset[]> => {
  const scope = getProjectPersistenceScope();
  const prepared = await externalizeBrowserProjectAssetJson(JSON.stringify(requireReadableFonts(incoming)), scope);
  const next = await updateBrowserKeyValue(
    getScopedProjectStorageNamespace('project-assets', scope),
    CUSTOM_FONT_ASSETS_STORAGE_KEY,
    (raw) => {
      // Read, merge, and validate the captured account in one native transaction.
      if (getProjectPersistenceScope() !== scope) throw new Error('The workspace account changed while saving fonts. Both font libraries were left unchanged.');
      const current = requireReadableFonts(raw === null ? [] : JSON.parse(raw));
      return JSON.stringify(requireReadableFonts(update(current, requireReadableFonts(JSON.parse(prepared.storedValue)))));
    },
  );
  notifyProjectFontsChanged();
  return requireReadableFonts(JSON.parse(next));
};

export const writeProjectFonts = async (fonts: ProjectFontAsset[]): Promise<ProjectFontAsset[]> => (
  mutateProjectFonts(fonts, (_current, prepared) => prepared)
);

export const upsertProjectFont = async (font: ProjectFontAsset): Promise<ProjectFontAsset> => {
  await mutateProjectFonts([font], (current, [prepared]) => current.some((candidate) => candidate.id === prepared.id)
    ? current.map((candidate) => candidate.id === prepared.id ? prepared : candidate)
    : [...current, prepared]);
  return font;
};

export const removeProjectFont = async (fontId: string): Promise<void> => {
  await mutateProjectFonts([], (current) => current.filter((font) => font.id !== fontId));
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
