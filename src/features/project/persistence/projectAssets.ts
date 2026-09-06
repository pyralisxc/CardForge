import { createScopedProjectStorage, getProjectPersistenceScope, getScopedProjectStorageNamespace } from './projectPersistenceScope';
import { externalizeBrowserProjectAssetJson } from './contentAddressedBrowserAssets';
import { updateBrowserKeyValue } from './indexedDbStorage';

export interface ProjectAssetStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  mergeItems: (key: string, assets: unknown[]) => Promise<unknown[]>;
}

export const getProjectAssetStorage = (): ProjectAssetStorage => {
  const storage = createScopedProjectStorage('project-assets');
  return {
    getItem: async (key) => await storage.getItem(key),
    setItem: async (key, value) => {
      await storage.setItem(key, value);
    },
    mergeItems: async (key, assets) => {
      const scope = getProjectPersistenceScope();
      const incoming = await externalizeBrowserProjectAssetJson(JSON.stringify(assets), scope);
      const next = await updateBrowserKeyValue(getScopedProjectStorageNamespace('project-assets', scope), key, (current) => {
        const merged = new Map<string, unknown>();
        [...parseAssetList(current, key), ...parseAssetList(incoming.storedValue, key)].forEach((asset, index) => {
          const id = typeof asset === 'object' && asset !== null && 'id' in asset && typeof asset.id === 'string'
            ? asset.id : `__asset_${index}`;
          merged.set(id, asset);
        });
        return JSON.stringify(Array.from(merged.values()));
      });
      return parseAssetList(next, key);
    },
  };
};

export const canUploadCustomLocalAssets = ({
  authConfigured,
  isSignedIn,
}: {
  authConfigured: boolean;
  isSignedIn: boolean;
}): boolean => authConfigured && isSignedIn;

const parseAssetList = (value: string | null, key: string): unknown[] => {
  if (value === null) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(`Local asset storage “${key}” is invalid.`);
  }
  return parsed;
};

export const readProjectAssetListFromStorage = async (
  storage: Pick<ProjectAssetStorage, 'getItem'>,
  key: string,
): Promise<unknown[]> => parseAssetList(await storage.getItem(key), key);

export const readTypedProjectAssetListFromStorage = async <T>(
  storage: Pick<ProjectAssetStorage, 'getItem'>,
  key: string,
): Promise<T[]> => readProjectAssetListFromStorage(storage, key) as Promise<T[]>;

export const writeProjectAssetListToStorage = async (
  storage: Pick<ProjectAssetStorage, 'setItem'>,
  key: string,
  assets: unknown[],
): Promise<void> => {
  await storage.setItem(key, JSON.stringify(assets));
};

export const mergeProjectAssetListToStorage = async <T>(
  storage: Pick<ProjectAssetStorage, 'mergeItems'>,
  key: string,
  assets: T[],
): Promise<T[]> => await storage.mergeItems(key, assets) as T[];
