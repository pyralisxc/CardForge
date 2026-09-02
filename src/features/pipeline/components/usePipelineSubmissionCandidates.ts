"use client";

import { useEffect, useMemo, useState } from 'react';

import type { CardAssetOption } from '@/features/pipeline/lib/cardAssets';
import {
  createAssetFile,
  deduplicatePersonalLibraryItems,
  getExtensionForAssetUrl,
  slugifyFileName,
  type PersonalLibraryFilter,
  type PersonalLibraryItem,
} from '@/features/pipeline/components/PipelineContributionModel';
import { CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY } from '@/features/project/client/package-document';
import { createCardForgeProjectPackageBlob } from '@/features/project/client/package-core';
import { captureCardSetProjectDocument, useProjectStore } from '@/features/project/client/workspace';
import { getProjectAssetStorage, readTypedProjectAssetListFromStorage } from '@/features/project/client/assets';
import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { isProjectBinaryAssetReference } from '@/features/project/client/persistence-binaries';
import { readBrowserProjectAssetReference } from '@/features/project/client/binary-assets';
import { buildBrowserCardForgeProjectSnapshot } from '@/features/project/client/project-packages';

const emptyPersonalAssets = {
  textures: [] as CardAssetOption[],
  dividers: [] as CardAssetOption[],
  icons: [] as CardAssetOption[],
  imageAssets: [] as CardAssetOption[],
};

const createStoredAssetFile = async (asset: CardAssetOption, fileNameStem: string): Promise<File> => {
  if (!isProjectBinaryAssetReference(asset.url)) return createAssetFile(asset, fileNameStem);
  const resolved = await readBrowserProjectAssetReference(asset.url, getProjectPersistenceScope());
  if (!resolved) throw new Error(`Unable to read ${asset.name}.`);
  const extension = getExtensionForAssetUrl(`data:${resolved.mimeType};base64,`);
  const bytes = Uint8Array.from(resolved.bytes);
  return new File([bytes.buffer], `${fileNameStem}.${extension}`, { type: resolved.mimeType });
};

/** One projection of personal objects that can cross the Forge Review boundary. */
export function usePipelineSubmissionCandidates() {
  const [filter, setFilter] = useState<PersonalLibraryFilter>('all');
  const [assets, setAssets] = useState(emptyPersonalAssets);
  const cardSets = useProjectStore((state) => state.cardSets);

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
      ['textures', 'This device · texture', assets.textures],
      ['dividers', 'This device · divider', assets.dividers],
      ['icons', 'This device · icon', assets.icons],
      ['imageAssets', 'This device · image', assets.imageAssets],
    ] as const).flatMap(([assetType, sourceLabel, storedAssets]) => storedAssets.map((asset) => {
      const fileNameStem = slugifyFileName(asset.name || asset.id, assetType);
      return {
        id: `${assetType}-${asset.id}`,
        name: asset.name || asset.id,
        sourceLabel,
        assetType,
        fileName: `${fileNameStem}.${getExtensionForAssetUrl(asset.url)}`,
        helperText: asset.packName ? `Library asset from ${asset.packName}.` : 'Saved device art from CardForge.',
        previewUrl: asset.url,
        createFile: async () => createStoredAssetFile(asset, fileNameStem),
      };
    }));

    const setItems: PersonalLibraryItem[] = cardSets.map((set) => {
      const fileNameStem = slugifyFileName(set.name, 'cardforge-set');
      return {
        id: `set-${set.id}`,
        name: set.name,
        sourceLabel: 'Personal Library · This device',
        assetType: 'sets',
        fileName: `${fileNameStem}.cardforge`,
        helperText: 'A complete portable Set package with cards, Templates, settings, and embedded assets.',
        createFile: async () => {
          const document = await captureCardSetProjectDocument(set.id);
          const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name: set.name });
          const blob = await createCardForgeProjectPackageBlob(snapshot);
          return new File([blob], `${fileNameStem}.cardforge`, { type: 'application/vnd.cardforge.project+zip' });
        },
      };
    });
    return deduplicatePersonalLibraryItems([...setItems, ...assetItems]);
  }, [assets, cardSets]);

  const visibleItems = useMemo(() => filter === 'all' ? items : items.filter((item) => item.assetType === filter), [filter, items]);
  return { filter, setFilter, items, visibleItems };
}
