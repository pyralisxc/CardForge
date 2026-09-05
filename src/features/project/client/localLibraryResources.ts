import type { CardAssetOption } from '@/domain/templates';
import { getProjectAssetStorage, readRequiredTypedProjectAssetListFromStorage, normalizeProjectFontAsset } from '@/features/project/client/assets';
import { CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, CUSTOM_FONT_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY } from '@/features/project/client/package-document';
import { projectLocalLibraryAsset, projectLocalLibraryFont, type LocalLibraryCollection, type LocalLibraryResource } from '../model/localLibraryResources';

const assetCollections = [
  ['texture', CUSTOM_TEXTURE_ASSETS_STORAGE_KEY],
  ['divider', CUSTOM_DIVIDER_ASSETS_STORAGE_KEY],
  ['icon', CUSTOM_ICON_ASSETS_STORAGE_KEY],
  ['image', CUSTOM_IMAGE_ASSETS_STORAGE_KEY],
] as const;

export const readLocalLibraryResources = async (dependencies = {
  readAssets: (key: string) => readRequiredTypedProjectAssetListFromStorage<CardAssetOption>(getProjectAssetStorage(), key),
  readFonts: async () => (await readRequiredTypedProjectAssetListFromStorage<unknown>(getProjectAssetStorage(), CUSTOM_FONT_ASSETS_STORAGE_KEY)).map((value) => {
    const font = normalizeProjectFontAsset(value);
    if (!font) throw new Error('The local font collection contains an unreadable font record. Restore a backup before changing it.');
    return font;
  }),
}): Promise<{ resources: LocalLibraryResource[]; failures: { collection: LocalLibraryCollection; error: unknown }[] }> => {
  const collections: LocalLibraryCollection[] = [...assetCollections.map(([collection]) => collection), 'font'];
  const results = await Promise.allSettled([
    ...assetCollections.map(async ([collection, key]) => (await dependencies.readAssets(key)).map((asset) => projectLocalLibraryAsset(collection, asset))),
    dependencies.readFonts().then((fonts) => fonts.map(projectLocalLibraryFont)),
  ]);
  return {
    resources: results.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
    failures: results.flatMap((result, index) => result.status === 'rejected' ? [{ collection: collections[index]!, error: result.reason }] : []),
  };
};
