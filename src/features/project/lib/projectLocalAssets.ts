export interface ProjectAssetStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const canUploadCustomLocalAssets = ({
  authConfigured,
  isSignedIn,
}: {
  authConfigured: boolean;
  isSignedIn: boolean;
}): boolean => authConfigured && isSignedIn;

export const readProjectAssetListFromStorage = (
  storage: ProjectAssetStorage,
  key: string,
): unknown[] => {
  try {
    const value = storage.getItem(key);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readTypedProjectAssetListFromStorage = <T>(
  storage: ProjectAssetStorage,
  key: string,
): T[] => readProjectAssetListFromStorage(storage, key) as T[];

export const writeProjectAssetListToStorage = (
  storage: ProjectAssetStorage,
  key: string,
  assets: unknown[],
) => {
  storage.setItem(key, JSON.stringify(assets));
};

export const mergeProjectAssetListToStorage = (
  storage: ProjectAssetStorage,
  key: string,
  assets: unknown[],
) => {
  const existingAssets = readProjectAssetListFromStorage(storage, key);
  const merged = new Map<string, unknown>();

  [...existingAssets, ...assets].forEach((asset, index) => {
    if (typeof asset === 'object' && asset !== null && 'id' in asset && typeof asset.id === 'string') {
      merged.set(asset.id, asset);
      return;
    }
    merged.set(`__asset_${index}`, asset);
  });

  storage.setItem(key, JSON.stringify(Array.from(merged.values())));
};
