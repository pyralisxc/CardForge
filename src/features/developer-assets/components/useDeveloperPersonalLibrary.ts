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
} from '@/features/project/client';
import {
  createAssetFile,
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

    return deduplicatePersonalLibraryItems(assetItems);
  }, [assets]);

  const visibleItems = useMemo(
    () => filter === 'all' ? items : items.filter((item) => item.assetType === filter),
    [filter, items]
  );

  return { filter, setFilter, items, visibleItems };
}
