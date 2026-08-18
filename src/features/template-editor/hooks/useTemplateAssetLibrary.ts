"use client";

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';

import type { CardAssetOption } from '@/features/developer-assets/client/assets';
import { loadCardForgeStudioAssets } from '@/features/developer-assets/client/catalog';
import { getAssetKindLabel, normalizeLocalLibraryAsset } from '@/features/developer-assets/client/assets';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '@/features/project/client';
import type { useToast } from '@/components/ui/use-toast';
import {
  getDefaultStudioAssetDestinations,
  type FreeformCardElement,
  type StudioAssetDestination,
} from '@/domain/templates';
import { getBrowserStorageHealth, optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client';
import {
  getProjectAssetStorage,
  readTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from '@/features/project/client';
import { loadPersonalStudioMedia, uploadPersonalStudioMedia } from '@/features/studio-media/client';

type ToastFn = ReturnType<typeof useToast>['toast'];
type EditableAssetKind = 'texture' | 'divider' | 'icon' | 'image';

const DURABLE_STUDIO_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const isRoutedTo = (asset: CardAssetOption, destination: StudioAssetDestination): boolean => {
  const routes = asset.studioDestinations ?? getDefaultStudioAssetDestinations({
    kind: asset.kind as 'texture' | 'divider' | 'icon' | 'image' | 'template' | 'elementPreset',
  });
  return routes.includes(destination);
};

interface UseTemplateAssetLibraryInput {
  selectedElement: FreeformCardElement | null;
  canUseBackgroundTexture: boolean;
  canUploadCustomAssets: boolean;
  toast: ToastFn;
}

const readStoredAssets = async (primaryKey: string): Promise<CardAssetOption[]> => {
  try {
    const storage = getProjectAssetStorage();
    const assets = await readTypedProjectAssetListFromStorage<CardAssetOption>(storage, primaryKey);
    let changed = false;
    const normalizedAssets = assets.map((asset) => {
      if (asset.librarySource !== 'local') return asset;
      if (asset.registryStatus === 'localOnly' && asset.accessTier === undefined) return asset;
      changed = true;
      return normalizeLocalLibraryAsset(asset);
    });
    if (changed) await writeProjectAssetListToStorage(storage, primaryKey, normalizedAssets);
    return normalizedAssets;
  } catch {
    return [];
  }
};

const mergeAssetLists = (...lists: CardAssetOption[][]): CardAssetOption[] => {
  const byId = new Map<string, CardAssetOption>();
  lists.flat().forEach((asset) => byId.set(asset.id, asset));
  return [...byId.values()];
};

const storageKeyForKind = (kind: EditableAssetKind): string => (
  kind === 'texture'
    ? CUSTOM_TEXTURE_ASSETS_STORAGE_KEY
    : kind === 'divider'
      ? CUSTOM_DIVIDER_ASSETS_STORAGE_KEY
      : kind === 'icon'
        ? CUSTOM_ICON_ASSETS_STORAGE_KEY
        : CUSTOM_IMAGE_ASSETS_STORAGE_KEY
);

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const value = event.target?.result;
    if (typeof value === 'string') resolve(value);
    else reject(new Error('The selected artwork could not be read.'));
  };
  reader.onerror = () => reject(reader.error ?? new Error('Failed to read the selected artwork.'));
  reader.readAsDataURL(file);
});

export function useTemplateAssetLibrary({
  selectedElement,
  canUseBackgroundTexture,
  canUploadCustomAssets,
  toast,
}: UseTemplateAssetLibraryInput) {
  const [assetSearch, setAssetSearch] = useState('');
  const [discoveredTextureAssets, setDiscoveredTextureAssets] = useState<CardAssetOption[]>([]);
  const [discoveredDividerAssets, setDiscoveredDividerAssets] = useState<CardAssetOption[]>([]);
  const [discoveredIconAssets, setDiscoveredIconAssets] = useState<CardAssetOption[]>([]);
  const [discoveredImageAssets, setDiscoveredImageAssets] = useState<CardAssetOption[]>([]);
  const [customTextureAssets, setCustomTextureAssets] = useState<CardAssetOption[]>([]);
  const [customDividerAssets, setCustomDividerAssets] = useState<CardAssetOption[]>([]);
  const [customIconAssets, setCustomIconAssets] = useState<CardAssetOption[]>([]);
  const [customImageAssets, setCustomImageAssets] = useState<CardAssetOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadCustomAssets = async () => {
      const [textures, dividers, icons, images, personalLibrary] = await Promise.all([
        readStoredAssets(CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
        readStoredAssets(CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
        readStoredAssets(CUSTOM_ICON_ASSETS_STORAGE_KEY),
        readStoredAssets(CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
        canUploadCustomAssets
          ? loadPersonalStudioMedia().catch((error) => {
              console.warn('Unable to load personal Studio media:', error);
              return null;
            })
          : Promise.resolve(null),
      ]);
      if (cancelled) return;
      const personalAssets = personalLibrary?.assets ?? [];
      setCustomTextureAssets(mergeAssetLists(
        textures,
        personalAssets.filter((asset) => asset.kind === 'texture'),
      ));
      setCustomDividerAssets(mergeAssetLists(
        dividers,
        personalAssets.filter((asset) => asset.kind === 'divider'),
      ));
      setCustomIconAssets(mergeAssetLists(
        icons,
        personalAssets.filter((asset) => asset.kind === 'icon'),
      ));
      setCustomImageAssets(mergeAssetLists(
        images,
        personalAssets.filter((asset) => asset.kind === 'image'),
      ));
    };
    void loadCustomAssets();
    return () => {
      cancelled = true;
    };
  }, [canUploadCustomAssets]);

  useEffect(() => {
    let cancelled = false;

    const loadDiscoveredAssets = async () => {
      try {
        const payload = (await loadCardForgeStudioAssets()).assets;
        if (cancelled) return;
        if (Array.isArray(payload.textures) && payload.textures.length > 0) {
          setDiscoveredTextureAssets(payload.textures);
        }
        if (Array.isArray(payload.dividers) && payload.dividers.length > 0) {
          setDiscoveredDividerAssets(payload.dividers);
        }
        if (Array.isArray(payload.icons) && payload.icons.length > 0) {
          setDiscoveredIconAssets(payload.icons);
        }
        const nextImageAssets = Array.isArray(payload.imageAssets) ? payload.imageAssets : [];
        if (nextImageAssets.length > 0) {
          setDiscoveredImageAssets(nextImageAssets);
        }
      } catch (error) {
        console.warn('Unable to load discovered card assets:', error);
      }
    };

    void loadDiscoveredAssets();

    return () => {
      cancelled = true;
    };
  }, []);

  const compatibleTextureAssets = useMemo(() => {
    if (!selectedElement || !canUseBackgroundTexture) return [];
    const target = selectedElement.type === 'shape' ? 'shape' : 'text';
    const search = assetSearch.trim().toLowerCase();
    return [...discoveredTextureAssets, ...customTextureAssets]
      .filter((asset) => isRoutedTo(asset, 'appearance.texture'))
      .filter((asset) => asset.allowedTargets.includes(target))
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, canUseBackgroundTexture, customTextureAssets, discoveredTextureAssets, selectedElement]);

  const compatibleDividerAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return [...discoveredDividerAssets, ...customDividerAssets]
      .filter((asset) => isRoutedTo(asset, 'element.divider'))
      .filter((asset) => asset.allowedTargets.includes('divider'))
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, customDividerAssets, discoveredDividerAssets]);

  const compatibleIconAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return [...discoveredIconAssets, ...customIconAssets]
      .filter((asset) => isRoutedTo(asset, 'element.icon'))
      .filter((asset) => asset.allowedTargets.includes('icon'))
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, customIconAssets, discoveredIconAssets]);

  const compatibleImageAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return [...discoveredImageAssets.filter((asset) => isRoutedTo(asset, 'image.picture')), ...customImageAssets]
      .filter((asset) => asset.allowedTargets.includes('image'))
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, customImageAssets, discoveredImageAssets]);

  const frontFrameAssets = useMemo(
    () => discoveredImageAssets.filter((asset) => isRoutedTo(asset, 'image.frame.front')),
    [discoveredImageAssets],
  );

  const backFrameAssets = useMemo(
    () => discoveredImageAssets.filter((asset) => isRoutedTo(asset, 'image.frame.back')),
    [discoveredImageAssets],
  );

  const currentAssetsForKind = useCallback((kind: EditableAssetKind): CardAssetOption[] => (
    kind === 'texture'
      ? customTextureAssets
      : kind === 'divider'
        ? customDividerAssets
        : kind === 'icon'
          ? customIconAssets
          : customImageAssets
  ), [customDividerAssets, customIconAssets, customImageAssets, customTextureAssets]);

  const setAssetsForKind = useCallback((kind: EditableAssetKind, assets: CardAssetOption[]) => {
    if (kind === 'texture') setCustomTextureAssets(assets);
    else if (kind === 'divider') setCustomDividerAssets(assets);
    else if (kind === 'icon') setCustomIconAssets(assets);
    else setCustomImageAssets(assets);
  }, []);

  const persistAssetMetadata = useCallback(async (
    kind: EditableAssetKind,
    asset: CardAssetOption,
  ) => {
    const nextAssets = mergeAssetLists(currentAssetsForKind(kind), [asset]);
    await writeProjectAssetListToStorage(
      getProjectAssetStorage(),
      storageKeyForKind(kind),
      nextAssets,
    );
    setAssetsForKind(kind, nextAssets);
  }, [currentAssetsForKind, setAssetsForKind]);

  const handleAssetUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>, kind: EditableAssetKind) => {
    if (!canUploadCustomAssets) {
      event.target.value = '';
      toast({
        title: 'Sign in to add personal art',
        description: 'Signed-in artwork can be reused from your personal Studio library across devices.',
      });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validateLocalAssetFile(file);
    if (!validation.ok) {
      event.target.value = '';
      toast({ title: 'Artwork Not Added', description: validation.message, variant: 'destructive' });
      return;
    }

    let storedFile = file;
    try {
      storedFile = await optimizeLocalAssetFile(file);
    } catch (error) {
      event.target.value = '';
      toast({
        title: 'Artwork Not Added',
        description: error instanceof Error ? error.message : 'The artwork dimensions could not be validated.',
        variant: 'destructive',
      });
      return;
    }

    const assetName = file.name.replace(/\.[^.]+$/, '') || 'Studio artwork';
    let durableUploadError: unknown = null;
    if (DURABLE_STUDIO_MEDIA_TYPES.has(storedFile.type.toLowerCase())) {
      try {
        const { asset } = await uploadPersonalStudioMedia({
          file: storedFile,
          kind,
          name: assetName,
        });
        try {
          await persistAssetMetadata(kind, asset);
        } catch (error) {
          console.warn('Unable to cache personal Studio asset metadata locally:', error);
          setAssetsForKind(kind, mergeAssetLists(currentAssetsForKind(kind), [asset]));
        }
        toast({
          title: 'Personal asset added',
          description: `${file.name} is saved to your CardForge Studio media library.`,
        });
        event.target.value = '';
        return;
      } catch (error) {
        durableUploadError = error;
        console.warn('Unable to save durable Studio media; falling back to browser storage:', error);
      }
    }

    let dataUri: string;
    try {
      dataUri = await readFileAsDataUrl(storedFile);
    } catch (error) {
      event.target.value = '';
      toast({
        title: 'Upload Error',
        description: error instanceof Error ? error.message : 'Failed to read the selected asset.',
        variant: 'destructive',
      });
      return;
    }

    const storageHealth = await getBrowserStorageHealth();
    if (storageHealth.level === 'critical' || (
      storageHealth.remainingBytes !== null && storageHealth.remainingBytes < storedFile.size * 1.5
    )) {
      event.target.value = '';
      toast({
        title: 'Browser Storage Almost Full',
        description: 'Download a project backup and free browser storage before adding more artwork.',
        variant: 'destructive',
      });
      return;
    }

    const asset = normalizeLocalLibraryAsset({
      id: `custom-${kind}-${nanoid()}`,
      name: assetName,
      url: dataUri,
      kind,
      fileSizeBytes: storedFile.size,
      tileMode: kind === 'texture' ? 'repeat' : kind === 'divider' ? 'stretch' : 'contain',
      seamless: kind === 'texture',
      allowedTargets: kind === 'texture'
        ? ['text', 'shape', 'template']
        : kind === 'divider'
          ? ['divider']
          : kind === 'icon'
            ? ['icon']
            : ['image', 'imageFrame', 'template'],
      defaultBlendMode: kind === 'texture' ? 'multiply' : 'normal',
      defaultOpacity: kind === 'texture' ? 45 : 100,
      defaultScale: kind === 'texture' ? 160 : 100,
      defaultWidth: kind === 'icon' ? 64 : kind === 'image' ? 300 : undefined,
      defaultHeight: kind === 'icon' ? 64 : kind === 'image' ? 180 : undefined,
    });

    try {
      await persistAssetMetadata(kind, asset);
    } catch (error) {
      console.error('Unable to persist local artwork:', error);
      event.target.value = '';
      toast({
        title: 'Artwork Not Saved',
        description: 'Browser storage rejected the artwork. Download a project backup, free storage, and try again.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Local asset added',
      description: durableUploadError
        ? `${file.name} is saved in this browser because the personal media service was unavailable.`
        : `${file.name} added to local ${getAssetKindLabel(kind).toLowerCase()} assets.`,
    });
    event.target.value = '';
  }, [
    canUploadCustomAssets,
    currentAssetsForKind,
    persistAssetMetadata,
    setAssetsForKind,
    toast,
  ]);

  return {
    assetSearch,
    compatibleDividerAssets,
    compatibleIconAssets,
    compatibleImageAssets,
    compatibleTextureAssets,
    frontFrameAssets,
    backFrameAssets,
    canUploadCustomAssets,
    handleAssetUpload,
    setAssetSearch,
  };
}
