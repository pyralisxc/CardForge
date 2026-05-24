"use client";

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';

import { CARD_DIVIDER_ASSETS, CARD_TEXTURE_ASSETS, type CardAssetOption } from '@/lib/cardAssets';
import { loadBootstrapAssets } from '@/lib/clientBootstrapData';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '@/lib/projectDocument';
import type { useToast } from '@/hooks/use-toast';
import type { FreeformCardElement } from '@/types';

const LEGACY_CUSTOM_TEXTURE_ASSETS_STORAGE_KEY = 'cardforge-maker2-custom-textures';
const LEGACY_CUSTOM_DIVIDER_ASSETS_STORAGE_KEY = 'cardforge-maker2-custom-dividers';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface UseTemplateAssetLibraryInput {
  selectedElement: FreeformCardElement | null;
  canUseBackgroundTexture: boolean;
  canUploadCustomAssets: boolean;
  toast: ToastFn;
}

const readStoredAssets = (primaryKey: string, legacyKey: string): CardAssetOption[] => {
  try {
    const payload = localStorage.getItem(primaryKey) ?? localStorage.getItem(legacyKey) ?? '[]';
    const assets = JSON.parse(payload) as CardAssetOption[];
    if (!Array.isArray(assets)) return [];
    localStorage.setItem(primaryKey, JSON.stringify(assets));
    return assets;
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
  const [discoveredTextureAssets, setDiscoveredTextureAssets] = useState<CardAssetOption[]>(CARD_TEXTURE_ASSETS);
  const [discoveredDividerAssets, setDiscoveredDividerAssets] = useState<CardAssetOption[]>(CARD_DIVIDER_ASSETS);
  const [discoveredPartAssets, setDiscoveredPartAssets] = useState<CardAssetOption[]>([]);
  const [discoveredIconAssets, setDiscoveredIconAssets] = useState<CardAssetOption[]>([]);
  const [discoveredImageAssets, setDiscoveredImageAssets] = useState<CardAssetOption[]>([]);
  const [customTextureAssets, setCustomTextureAssets] = useState<CardAssetOption[]>([]);
  const [customDividerAssets, setCustomDividerAssets] = useState<CardAssetOption[]>([]);
  const [customIconAssets, setCustomIconAssets] = useState<CardAssetOption[]>([]);
  const [customImageAssets, setCustomImageAssets] = useState<CardAssetOption[]>([]);

  useEffect(() => {
    setCustomTextureAssets(readStoredAssets(CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, LEGACY_CUSTOM_TEXTURE_ASSETS_STORAGE_KEY));
    setCustomDividerAssets(readStoredAssets(CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, LEGACY_CUSTOM_DIVIDER_ASSETS_STORAGE_KEY));
    setCustomIconAssets(readStoredAssets(CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY));
    setCustomImageAssets(readStoredAssets(CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDiscoveredAssets = async () => {
      try {
        const payload = await loadBootstrapAssets();
        if (cancelled) return;
        if (Array.isArray(payload.textures) && payload.textures.length > 0) {
          setDiscoveredTextureAssets(payload.textures);
        }
        if (Array.isArray(payload.dividers) && payload.dividers.length > 0) {
          setDiscoveredDividerAssets(payload.dividers);
        }
        if (Array.isArray(payload.parts) && payload.parts.length > 0) {
          setDiscoveredPartAssets(payload.parts);
        }
        if (Array.isArray(payload.icons) && payload.icons.length > 0) {
          setDiscoveredIconAssets(payload.icons);
        }
        if (Array.isArray(payload.imageAssets) && payload.imageAssets.length > 0) {
          setDiscoveredImageAssets(payload.imageAssets);
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

  const compatiblePartAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return discoveredPartAssets
      .filter((asset) => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, discoveredPartAssets]);

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

  const handleAssetUpload = useCallback((event: ChangeEvent<HTMLInputElement>, kind: 'texture' | 'divider' | 'icon' | 'image') => {
    if (!canUploadCustomAssets) {
      event.target.value = '';
      toast({
        title: 'Sign in to add custom art',
        description: 'Custom textures and dividers are saved to your local asset library after you connect an account.',
      });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUri = loadEvent.target?.result as string;
      const asset: CardAssetOption = {
        id: `custom-${kind}-${nanoid()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        url: dataUri,
        kind,
        librarySource: 'local',
        accessTier: 'free',
        registryStatus: 'published',
        fileSizeBytes: file.size,
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
      };

      if (kind === 'texture') {
        setCustomTextureAssets((previous) => {
          const next = [...previous, asset];
          localStorage.setItem(CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } else if (kind === 'divider') {
        setCustomDividerAssets((previous) => {
          const next = [...previous, asset];
          localStorage.setItem(CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } else if (kind === 'icon') {
        setCustomIconAssets((previous) => {
          const next = [...previous, asset];
          localStorage.setItem(CUSTOM_ICON_ASSETS_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } else {
        setCustomImageAssets((previous) => {
          const next = [...previous, asset];
          localStorage.setItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }

      toast({ title: 'Asset Added', description: `${file.name} added to ${kind} assets.` });
    };
    reader.onerror = () => toast({ title: 'Upload Error', description: 'Failed to read the selected asset.', variant: 'destructive' });
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [canUploadCustomAssets, toast]);

  return {
    assetSearch,
    compatibleDividerAssets,
    compatibleIconAssets,
    compatibleImageAssets,
    compatiblePartAssets,
    compatibleTextureAssets,
    canUploadCustomAssets,
    handleAssetUpload,
    setAssetSearch,
  };
}
