import { revalidateTag, unstable_cache } from 'next/cache';

import {
  getCardForgeCatalogManifest,
  getCardForgeStudioAssetManifest,
  getCardForgeStudioBootstrapManifest,
} from '@/features/pipeline/lib/catalogManifest';
import type { RegistryViewerAccess } from '@/features/pipeline/lib/registryContentAssets';

export const CARDFORGE_CATALOG_TAG = 'public:cardforge-catalog';

const cachedCatalogs: Record<RegistryViewerAccess, () => ReturnType<typeof getCardForgeCatalogManifest>> = {
  free: unstable_cache(
    () => getCardForgeCatalogManifest('free'),
    ['cardforge-catalog', 'free'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
  paid: unstable_cache(
    () => getCardForgeCatalogManifest('paid'),
    ['cardforge-catalog', 'paid'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
  contributor: unstable_cache(
    () => getCardForgeCatalogManifest('contributor'),
    ['cardforge-catalog', 'contributor'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
};

const cachedStudioBootstraps: Record<RegistryViewerAccess, () => ReturnType<typeof getCardForgeStudioBootstrapManifest>> = {
  free: unstable_cache(
    () => getCardForgeStudioBootstrapManifest('free'),
    ['cardforge-studio-bootstrap', 'free'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
  paid: unstable_cache(
    () => getCardForgeStudioBootstrapManifest('paid'),
    ['cardforge-studio-bootstrap', 'paid'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
  contributor: unstable_cache(
    () => getCardForgeStudioBootstrapManifest('contributor'),
    ['cardforge-studio-bootstrap', 'contributor'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
};

const cachedStudioAssets: Record<RegistryViewerAccess, () => ReturnType<typeof getCardForgeStudioAssetManifest>> = {
  free: unstable_cache(
    () => getCardForgeStudioAssetManifest('free'),
    ['cardforge-studio-assets', 'free'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
  paid: unstable_cache(
    () => getCardForgeStudioAssetManifest('paid'),
    ['cardforge-studio-assets', 'paid'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
  contributor: unstable_cache(
    () => getCardForgeStudioAssetManifest('contributor'),
    ['cardforge-studio-assets', 'contributor'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
};

export const getCachedCardForgeCatalog = (access: RegistryViewerAccess = 'free') => (
  cachedCatalogs[access]()
);

export const getCachedCardForgeStudioBootstrap = (access: RegistryViewerAccess = 'free') => (
  cachedStudioBootstraps[access]()
);

export const getCachedCardForgeStudioAssets = (access: RegistryViewerAccess = 'free') => (
  cachedStudioAssets[access]()
);

export const revalidateCardForgeCatalog = (): void => {
  try {
    revalidateTag(CARDFORGE_CATALOG_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate CardForge catalog cache:', error);
  }
};
