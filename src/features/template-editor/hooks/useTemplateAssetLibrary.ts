"use client";

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';

import type { CardAssetOption } from '@/features/developer-assets/lib/cardAssets';
import { loadEditorAssets } from '@/features/template-editor/services/editorBootstrap';
import { getAssetKindLabel, normalizeLocalLibraryAsset } from '@/features/developer-assets/lib/pipelineAssetTaxonomy';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '@/features/project/client';
import type { useToast } from '@/components/ui/use-toast';
import type { FreeformCardElement } from '@/domain/templates';
import { getBrowserStorageHealth, optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client';
import {
  getProjectAssetStorage,
  readTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from '@/features/project/client';
type ToastFn = ReturnType<typeof useToast>['toast'];

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
    const normalizedAssets = assets.map((asset) => (
      asset.librarySource === 'local' ? normalizeLocalLibraryAsset(asset) : asset
    ));
    await writeProjectAssetListToStorage(storage, primaryKey, normalizedAssets);
    return normalizedAssets;
  } catch {
    return [];
  }
};

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
    };
    void loadCustomAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDiscoveredAssets = async () => {
      try {
        const payload = await loadEditorAssets();
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
        const nextImageAssets = [
          ...(Array.isArray(payload.imageAssets) ? payload.imageAssets : []),
          ...(Array.isArray(payload.parts) ? payload.parts : []),
        ];
        if (nextImageAssets.length > 0) {
          setDiscoveredImageAssets(nextImageAssets);
        }
      } catch (error) {
        console.warn('Unable to load discovered card assets:', error);
      }
    };

    loadDiscoveredAssets();

    return () => {
      cancelled = true;
    };
  }, []);

  const compatibleTextureAssets = useMemo(() => {
    if (!selectedElement || !canUseBackgroundTexture) return [];
    const target = selectedElement.type === 'shape' ? 'shape' : 'text';
    const search = assetSearch.trim().toLowerCase();
    return [...discoveredTextureAssets, ...customTextureAssets]
      .filter((asset) => asset.allowedTargets.includes(target))
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, canUseBackgroundTexture, customTextureAssets, discoveredTextureAssets, selectedElement]);

  const compatibleDividerAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return [...discoveredDividerAssets, ...customDividerAssets]
      .filter((asset) => asset.allowedTargets.includes('divider'))
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, customDividerAssets, discoveredDividerAssets]);

  const compatibleIconAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return [...discoveredIconAssets, ...customIconAssets]
      .filter((asset) => asset.allowedTargets.includes('icon'))
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, customIconAssets, discoveredIconAssets]);

  const compatibleImageAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return [...discoveredImageAssets, ...customImageAssets]
      .filter((asset) => asset.allowedTargets.includes('image') || asset.allowedTargets.includes('imageFrame'))
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, customImageAssets, discoveredImageAssets]);

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

      const storageHealth = await getBrowserStorageHealth();
      if (storageHealth.level === 'critical' || (
        storageHealth.remainingBytes !== null && storageHealth.remainingBytes < storedFile.size * 1.5
      )) {
        toast({
          title: 'Browser Storage Almost Full',
          description: 'Download a project backup and free browser storage before adding more artwork.',
          variant: 'destructive',
        });
        return;
      }

      const storageKey = kind === 'texture'
        ? CUSTOM_TEXTURE_ASSETS_STORAGE_KEY
        : kind === 'divider'
          ? CUSTOM_DIVIDER_ASSETS_STORAGE_KEY
          : kind === 'icon'
            ? CUSTOM_ICON_ASSETS_STORAGE_KEY
            : CUSTOM_IMAGE_ASSETS_STORAGE_KEY;
      const currentAssets = kind === 'texture'
        ? customTextureAssets
        : kind === 'divider'
          ? customDividerAssets
          : kind === 'icon'
            ? customIconAssets
            : customImageAssets;
      const nextAssets = [...currentAssets, asset];
      try {
        await writeProjectAssetListToStorage(getProjectAssetStorage(), storageKey, nextAssets);
      } catch (error) {
        console.error('Unable to persist local artwork:', error);
        toast({
          title: 'Artwork Not Saved',
          description: 'Browser storage rejected the artwork. Download a project backup, free storage, and try again.',
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
  }, [canUploadCustomAssets, customDividerAssets, customIconAssets, customImageAssets, customTextureAssets, toast]);

  return {
    assetSearch,
    compatibleDividerAssets,
    compatibleIconAssets,
    compatibleImageAssets,
    compatibleTextureAssets,
    canUploadCustomAssets,
    handleAssetUpload,
    setAssetSearch,
  };
}
