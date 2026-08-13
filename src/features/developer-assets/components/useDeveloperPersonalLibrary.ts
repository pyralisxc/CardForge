"use client";

import { useEffect, useMemo, useState } from 'react';

import type { CardAssetOption } from '@/features/developer-assets/lib/cardAssets';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  getProjectAssetStorage,
  readTypedProjectAssetListFromStorage,
  useProjectStore,
} from '@/features/project/client';
import {
  createAssetFile,
  createJsonFile,
  deduplicatePersonalLibraryItems,
  getExtensionForAssetUrl,
  slugifyFileName,
  type PersonalLibraryFilter,
  type PersonalLibraryItem,
} from '@/features/developer-assets/components/DeveloperAssetHubModel';

const emptyPersonalAssets = {
  textures: [] as CardAssetOption[],
  dividers: [] as CardAssetOption[],
  icons: [] as CardAssetOption[],
  imageAssets: [] as CardAssetOption[],
};

export function useDeveloperPersonalLibrary() {
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const appearanceStyles = useProjectStore((state) => state.appearanceStyles);
  const [filter, setFilter] = useState<PersonalLibraryFilter>('all');
  const [assets, setAssets] = useState(emptyPersonalAssets);

  useEffect(() => {
    const storage = getProjectAssetStorage();
    const refresh = async () => {
      const [textures, dividers, icons, imageAssets] = await Promise.all([
        readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
        readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
        readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
        readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
      ]);
      setAssets({ textures, dividers, icons, imageAssets });
    };

    const handleFocus = () => void refresh();
    handleFocus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const items = useMemo<PersonalLibraryItem[]>(() => {
    const templateItems = userTemplates.filter((template) => template.id).map((template) => {
      const fileNameStem = slugifyFileName(template.name || template.id || 'template', 'template');
      return {
        id: `template-${template.id}`,
        name: template.name || template.id || 'Untitled template',
        sourceLabel: 'Saved template',
        assetType: 'templates' as const,
        fileName: `${fileNameStem}.template.json`,
        helperText: 'Saved in this browser. Export a project file when you need a portable backup.',
        previewUrl: `/api/templates#${template.id}`,
        createFile: async () => createJsonFile(template, `${fileNameStem}.template.json`),
      };
    });

    const styleItems = appearanceStyles.filter((style) => style.id && !style.id.startsWith('default-')).map((style) => {
      const fileNameStem = slugifyFileName(style.name || style.id, 'appearance-style');
      return {
        id: `style-${style.id}`,
        name: style.name || style.id,
        sourceLabel: 'Appearance style',
        assetType: 'elementPresets' as const,
        fileName: `${fileNameStem}.style.json`,
        helperText: 'Saved Appearance Studio preset from this browser.',
        createFile: async () => createJsonFile(style, `${fileNameStem}.style.json`),
      };
    });

    const assetItems = ([
      ['textures', 'Local texture', assets.textures],
      ['dividers', 'Local divider', assets.dividers],
      ['icons', 'Local icon', assets.icons],
      ['imageAssets', 'Local image', assets.imageAssets],
    ] as const).flatMap(([assetType, sourceLabel, storedAssets]) => storedAssets.map((asset) => {
      const fileNameStem = slugifyFileName(asset.name || asset.id, assetType);
      return {
        id: `${assetType}-${asset.id}`,
        name: asset.name || asset.id,
        sourceLabel,
        assetType,
        fileName: `${fileNameStem}.${getExtensionForAssetUrl(asset.url)}`,
        helperText: asset.packName ? `Local asset from ${asset.packName}.` : 'Saved local art from Studio.',
        previewUrl: asset.url,
        createFile: async () => createAssetFile(asset, fileNameStem),
      };
    }));

    return deduplicatePersonalLibraryItems([...templateItems, ...styleItems, ...assetItems]);
  }, [appearanceStyles, assets, userTemplates]);

  const visibleItems = useMemo(
    () => filter === 'all' ? items : items.filter((item) => item.assetType === filter),
    [filter, items]
  );

  return { filter, setFilter, items, visibleItems };
}
