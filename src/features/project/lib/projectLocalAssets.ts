import { createMigratingBrowserStorage } from '@/features/project/lib/browserStorage';

export interface ProjectAssetStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
}

export const getProjectAssetStorage = (): ProjectAssetStorage => {
  const storage = createMigratingBrowserStorage(
    'project-assets',
    typeof window !== 'undefined' ? window.localStorage : undefined,
  );
  return {
    getItem: async (key) => await storage.getItem(key),
    setItem: async (key, value) => {
      await storage.setItem(key, value);
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

export const readProjectAssetListFromStorage = async (
  storage: ProjectAssetStorage,
  key: string,
): Promise<unknown[]> => {
  try {
    const value = await storage.getItem(key);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readTypedProjectAssetListFromStorage = async <T>(
  storage: ProjectAssetStorage,
  key: string,
): Promise<T[]> => readProjectAssetListFromStorage(storage, key) as Promise<T[]>;

export const writeProjectAssetListToStorage = async (
  storage: ProjectAssetStorage,
  key: string,
  assets: unknown[],
): Promise<void> => {
  await storage.setItem(key, JSON.stringify(assets));
};

export const mergeProjectAssetListToStorage = async (
  storage: ProjectAssetStorage,
  key: string,
  assets: unknown[],
): Promise<void> => {
  const existingAssets = await readProjectAssetListFromStorage(storage, key);
  const merged = new Map<string, unknown>();

  [...existingAssets, ...assets].forEach((asset, index) => {
    if (typeof asset === 'object' && asset !== null && 'id' in asset && typeof asset.id === 'string') {
      merged.set(asset.id, asset);
      return;
    }
    merged.set(`__asset_${index}`, asset);
  });

  await storage.setItem(key, JSON.stringify(Array.from(merged.values())));
};
