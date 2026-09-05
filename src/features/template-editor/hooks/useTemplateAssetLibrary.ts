"use client";

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';

import type { useToast } from '@/components/ui/use-toast';
import {
  getDefaultStudioAssetDestinations,
  type FreeformCardElement,
  type StudioAssetDestination,
} from '@/domain/templates';
import type { CardAssetOption } from '@/features/pipeline/client/assets';
import { getAssetKindLabel, normalizeLocalLibraryAsset } from '@/features/pipeline/client/assets';
import { loadCardForgeStudioAssets } from '@/features/pipeline/client/catalog';
import {
  chooseGoogleDrivePersonalLibraryItems,
  importPersonalLibraryItemToLocalAsset,
  loadPersonalLibrary,
  type PersonalLibraryItem,
  type PersonalLibraryRole,
} from '@/features/personal-library/client';
import { CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY } from '@/features/project/client/package-document';
import { getProjectAssetStorage, readTypedProjectAssetListFromStorage, mergeProjectAssetListToStorage } from '@/features/project/client/assets';
import { optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client/persistence-storage';

type ToastFn = ReturnType<typeof useToast>['toast'];

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
  const assets = await readTypedProjectAssetListFromStorage<CardAssetOption>(getProjectAssetStorage(), primaryKey);
  return assets.map((asset) => asset.librarySource === 'local' ? normalizeLocalLibraryAsset(asset) : asset);
};

const replaceAssetById = (assets: CardAssetOption[], nextAsset: CardAssetOption) => {
  const existing = assets.findIndex((asset) => asset.id === nextAsset.id);
  return existing >= 0
    ? assets.map((asset, index) => index === existing ? nextAsset : asset)
    : [...assets, nextAsset];
};

export function useTemplateAssetLibrary({
  selectedElement,
  canUseBackgroundTexture,
  canUploadCustomAssets,
  toast,
}: UseTemplateAssetLibraryInput) {
  const [discoveredTextureAssets, setDiscoveredTextureAssets] = useState<CardAssetOption[]>([]);
  const [discoveredDividerAssets, setDiscoveredDividerAssets] = useState<CardAssetOption[]>([]);
  const [discoveredIconAssets, setDiscoveredIconAssets] = useState<CardAssetOption[]>([]);
  const [discoveredImageAssets, setDiscoveredImageAssets] = useState<CardAssetOption[]>([]);
  const [customTextureAssets, setCustomTextureAssets] = useState<CardAssetOption[]>([]);
  const [customDividerAssets, setCustomDividerAssets] = useState<CardAssetOption[]>([]);
  const [customIconAssets, setCustomIconAssets] = useState<CardAssetOption[]>([]);
  const [customImageAssets, setCustomImageAssets] = useState<CardAssetOption[]>([]);
  const [connectedLibraryItems, setConnectedLibraryItems] = useState<PersonalLibraryItem[]>([]);

  const refreshLocalAssets = useCallback(async () => {
    const [textures, dividers, icons, images] = await Promise.all([
      readStoredAssets(CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
      readStoredAssets(CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
      readStoredAssets(CUSTOM_ICON_ASSETS_STORAGE_KEY),
      readStoredAssets(CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
    ]);
    setCustomTextureAssets(textures);
    setCustomDividerAssets(dividers);
    setCustomIconAssets(icons);
    setCustomImageAssets(images);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [textures, dividers, icons, images] = await Promise.all([
        readStoredAssets(CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
        readStoredAssets(CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
        readStoredAssets(CUSTOM_ICON_ASSETS_STORAGE_KEY),
        readStoredAssets(CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
      ]);
      if (cancelled) return;
      setCustomTextureAssets(textures);
      setCustomDividerAssets(dividers);
      setCustomIconAssets(icons);
      setCustomImageAssets(images);
    })().catch((error) => {
      if (!cancelled) toast({ title: 'Local artwork unavailable', description: error instanceof Error ? error.message : 'The saved artwork could not be read. Try reopening the library.', variant: 'destructive' });
    });
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    if (!canUploadCustomAssets) {
      setConnectedLibraryItems([]);
      return;
    }
    let cancelled = false;
    void loadPersonalLibrary()
      .then((library) => {
        if (!cancelled) setConnectedLibraryItems(library.items);
      })
      .catch((error) => {
        if (!cancelled) console.warn('Unable to load connected personal assets in Template Studio:', error);
      });
    return () => { cancelled = true; };
  }, [canUploadCustomAssets]);

  useEffect(() => {
    let cancelled = false;

    const loadDiscoveredAssets = async () => {
      try {
        const payload = (await loadCardForgeStudioAssets()).assets;
        if (cancelled) return;
        if (Array.isArray(payload.textures) && payload.textures.length > 0) setDiscoveredTextureAssets(payload.textures);
        if (Array.isArray(payload.dividers) && payload.dividers.length > 0) setDiscoveredDividerAssets(payload.dividers);
        if (Array.isArray(payload.icons) && payload.icons.length > 0) setDiscoveredIconAssets(payload.icons);
        const nextImageAssets = Array.isArray(payload.imageAssets) ? payload.imageAssets : [];
        if (nextImageAssets.length > 0) setDiscoveredImageAssets(nextImageAssets);
      } catch (error) {
        console.warn('Unable to load discovered card assets:', error);
      }
    };

    void loadDiscoveredAssets();
    return () => { cancelled = true; };
  }, []);

  const compatibleTextureAssets = useMemo(() => {
    if (!selectedElement || !canUseBackgroundTexture) return [];
    const target = selectedElement.type === 'shape' ? 'shape' : 'text';
    return [...discoveredTextureAssets, ...customTextureAssets]
      .filter((asset) => isRoutedTo(asset, 'appearance.texture'))
      .filter((asset) => asset.allowedTargets.includes(target));
  }, [canUseBackgroundTexture, customTextureAssets, discoveredTextureAssets, selectedElement]);

  const compatibleDividerAssets = useMemo(() => {
    return [...discoveredDividerAssets, ...customDividerAssets]
      .filter((asset) => isRoutedTo(asset, 'element.divider'))
      .filter((asset) => asset.allowedTargets.includes('divider'));
  }, [customDividerAssets, discoveredDividerAssets]);

  const compatibleIconAssets = useMemo(() => {
    return [...discoveredIconAssets, ...customIconAssets]
      .filter((asset) => isRoutedTo(asset, 'element.icon'))
      .filter((asset) => asset.allowedTargets.includes('icon'));
  }, [customIconAssets, discoveredIconAssets]);

  const compatibleImageAssets = useMemo(() => {
    return [...discoveredImageAssets, ...customImageAssets]
      .filter((asset) => isRoutedTo(asset, 'image.picture'))
      .filter((asset) => asset.allowedTargets.includes('image'));
  }, [customImageAssets, discoveredImageAssets]);

  const allImageAssets = useMemo(() => [...discoveredImageAssets, ...customImageAssets], [customImageAssets, discoveredImageAssets]);
  const frontFrameAssets = useMemo(
    () => allImageAssets.filter((asset) => isRoutedTo(asset, 'image.frame.front')),
    [allImageAssets],
  );
  const backFrameAssets = useMemo(
    () => allImageAssets.filter((asset) => isRoutedTo(asset, 'image.frame.back')),
    [allImageAssets],
  );
  const frontBorderAssets = useMemo(
    () => allImageAssets.filter((asset) => isRoutedTo(asset, 'image.border.front')),
    [allImageAssets],
  );
  const backBorderAssets = useMemo(
    () => allImageAssets.filter((asset) => isRoutedTo(asset, 'image.border.back')),
    [allImageAssets],
  );

  const importConnectedLibraryItem = useCallback(async (item: PersonalLibraryItem): Promise<CardAssetOption> => {
    const asset = await importPersonalLibraryItemToLocalAsset(item);
    if (asset.kind === 'texture') setCustomTextureAssets((current) => replaceAssetById(current, asset));
    else if (asset.kind === 'divider') setCustomDividerAssets((current) => replaceAssetById(current, asset));
    else if (asset.kind === 'icon') setCustomIconAssets((current) => replaceAssetById(current, asset));
    else setCustomImageAssets((current) => replaceAssetById(current, asset));
    toast({
      title: 'Connected asset ready in this project',
      description: `“${item.displayName}” was materialized from Google Drive into this browser's portable CardForge asset library.`,
    });
    return asset;
  }, [toast]);

  const addConnectedLibraryItems = useCallback(async (role: PersonalLibraryRole): Promise<void> => {
    const result = await chooseGoogleDrivePersonalLibraryItems(role);
    if (!result) return;
    setConnectedLibraryItems((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      result.items.forEach((item) => byId.set(item.id, item));
      return [...byId.values()];
    });
  }, []);

  const handleAssetUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>, kind: 'texture' | 'divider' | 'icon' | 'image') => {
    if (!canUploadCustomAssets) {
      event.target.value = '';
      toast({
        title: 'Sign in to add local art',
        description: "Custom images, icons, textures, and dividers are saved to this browser's local asset library after you connect an account.",
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

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const dataUri = loadEvent.target?.result as string;
      const asset = normalizeLocalLibraryAsset({
        id: `custom-${kind}-${nanoid()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
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

      const storageKey = kind === 'texture'
        ? CUSTOM_TEXTURE_ASSETS_STORAGE_KEY
        : kind === 'divider'
          ? CUSTOM_DIVIDER_ASSETS_STORAGE_KEY
          : kind === 'icon'
            ? CUSTOM_ICON_ASSETS_STORAGE_KEY
            : CUSTOM_IMAGE_ASSETS_STORAGE_KEY;
      let nextAssets: CardAssetOption[];
      try {
        nextAssets = await mergeProjectAssetListToStorage(getProjectAssetStorage(), storageKey, [asset]);
      } catch (error) {
        console.error('Unable to persist local artwork:', error);
        toast({
          title: 'Artwork Not Saved',
          description: error instanceof Error ? error.message : 'Browser storage could not safely update the artwork library. Try again.',
          variant: 'destructive',
        });
        return;
      }

      if (kind === 'texture') setCustomTextureAssets(nextAssets);
      else if (kind === 'divider') setCustomDividerAssets(nextAssets);
      else if (kind === 'icon') setCustomIconAssets(nextAssets);
      else setCustomImageAssets(nextAssets);

      toast({
        title: 'Local asset added',
        description: `${file.name} added to ${getAssetKindLabel(kind).toLowerCase()} assets.`,
      });
    };
    reader.onerror = () => toast({ title: 'Upload Error', description: 'Failed to read the selected asset.', variant: 'destructive' });
    reader.readAsDataURL(storedFile);
    event.target.value = '';
  }, [canUploadCustomAssets, toast]);

  return {
    compatibleDividerAssets,
    compatibleIconAssets,
    compatibleImageAssets,
    compatibleTextureAssets,
    frontFrameAssets,
    backFrameAssets,
    frontBorderAssets,
    backBorderAssets,
    canUploadCustomAssets,
    connectedLibraryItems,
    addConnectedLibraryItems,
    handleAssetUpload,
    importConnectedLibraryItem,
    refreshLocalAssets,
  };
}
