"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  deduplicatePersonalLibraryItems,
  getExtensionForAssetUrl,
  slugifyFileName,
  type PersonalLibraryFilter,
  type PersonalLibraryItem,
} from '@/features/pipeline/components/PipelineContributionModel';
import {
  materializePortableCardSetFile,
  materializePortableProjectAssetFile,
  readPortableProjectAssets,
  usePortableProjectSets,
  type PortableProjectAsset,
} from '@/features/project/client/portableObjects';

const assetTypeByCollection = {
  texture: 'textures',
  divider: 'dividers',
  icon: 'icons',
  image: 'imageAssets',
} as const;

const sourceLabelByCollection = {
  texture: 'This device · texture',
  divider: 'This device · divider',
  icon: 'This device · icon',
  image: 'This device · image',
} as const;

/** One projection of personal objects that can cross the Forge Review boundary. */
export function usePipelineSubmissionCandidates() {
  const [filter, setFilter] = useState<PersonalLibraryFilter>('all');
  const [assets, setAssets] = useState<PortableProjectAsset[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cardSets = usePortableProjectSets();

  const refresh = useCallback(async () => {
    try {
      setAssets(await readPortableProjectAssets());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Saved artwork could not be read.');
    }
  }, []);
  useEffect(() => {
    const handleFocus = () => void refresh();
    handleFocus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  const items = useMemo<PersonalLibraryItem[]>(() => {
    const assetItems = assets.map((asset) => {
      const assetType = assetTypeByCollection[asset.collection];
      const fileNameStem = slugifyFileName(asset.name || asset.id, assetType);
      return {
        id: `${assetType}-${asset.objectId}`,
        name: asset.name || asset.objectId,
        sourceLabel: sourceLabelByCollection[asset.collection],
        assetType,
        fileName: `${fileNameStem}.${getExtensionForAssetUrl(asset.source)}`,
        helperText: asset.packName ? `Library asset from ${asset.packName}.` : 'Saved device art from CardForge.',
        previewUrl: asset.previewSource,
        createFile: async () => materializePortableProjectAssetFile(asset, fileNameStem),
      };
    });

    const setItems: PersonalLibraryItem[] = cardSets.map((set) => {
      const fileNameStem = slugifyFileName(set.name, 'cardforge-set');
      return {
        id: `set-${set.id}`,
        name: set.name,
        sourceLabel: 'Personal Library · This device',
        assetType: 'sets',
        fileName: `${fileNameStem}.cardforge`,
        helperText: 'A complete portable Set package with cards, Templates, settings, and embedded assets.',
        createFile: async () => materializePortableCardSetFile({
          setId: set.id,
          name: set.name,
          fileName: `${fileNameStem}.cardforge`,
        }),
      };
    });
    return deduplicatePersonalLibraryItems([...setItems, ...assetItems]);
  }, [assets, cardSets]);

  const visibleItems = useMemo(() => filter === 'all' ? items : items.filter((item) => item.assetType === filter), [filter, items]);
  return { filter, setFilter, items, visibleItems, loadError, refresh };
}
