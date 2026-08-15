import { revalidateTag, unstable_cache } from 'next/cache';

import { getCardForgeCatalogManifest } from '@/features/developer-assets/lib/catalogManifest';
import type { RegistryViewerAccess } from '@/features/developer-assets/lib/registryContentAssets';

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
  dev: unstable_cache(
    () => getCardForgeCatalogManifest('dev'),
    ['cardforge-catalog', 'dev'],
    { tags: [CARDFORGE_CATALOG_TAG], revalidate: 300 },
  ),
};

export const getCachedCardForgeCatalog = (access: RegistryViewerAccess = 'free') => (
  cachedCatalogs[access]()
);

export const revalidateCardForgeCatalog = (): void => {
  try {
    revalidateTag(CARDFORGE_CATALOG_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate CardForge catalog cache:', error);
  }
};
