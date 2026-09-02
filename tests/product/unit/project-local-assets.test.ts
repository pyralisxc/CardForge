import { describe, expect, it } from 'vitest';

import { canUploadCustomLocalAssets, readRequiredProjectAssetListFromStorage, readProjectAssetListFromStorage, writeProjectAssetListToStorage } from '@/features/project/client/assets';

const createStorage = (initial: Record<string, string | null> = {}) => {
  const values = new Map(Object.entries(initial).filter((entry): entry is [string, string] => entry[1] !== null));
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
    values,
  };
};

describe('projectLocalAssets', () => {
  it('reads arrays from storage and returns empty arrays for missing or invalid values', async () => {
    const storage = createStorage({
      textures: JSON.stringify([{ id: 'asset-1' }]),
      invalid: '{not json',
      object: JSON.stringify({ id: 'not-array' }),
    });

    await expect(readProjectAssetListFromStorage(storage, 'textures')).resolves.toEqual([{ id: 'asset-1' }]);
    await expect(readProjectAssetListFromStorage(storage, 'missing')).resolves.toEqual([]);
    await expect(readProjectAssetListFromStorage(storage, 'invalid')).resolves.toEqual([]);
    await expect(readProjectAssetListFromStorage(storage, 'object')).resolves.toEqual([]);
  });

  it('writes asset arrays back to storage as JSON', async () => {
    const storage = createStorage();

    await writeProjectAssetListToStorage(storage, 'textures', [{ id: 'asset-1' }]);

    await expect(storage.getItem('textures')).resolves.toBe(JSON.stringify([{ id: 'asset-1' }]));
  });

  it('fails strict reads used by exports instead of silently omitting broken assets', async () => {
    const storage = createStorage({ invalid: '{not json' });

    await expect(readRequiredProjectAssetListFromStorage(storage, 'invalid')).rejects.toThrow();
    await expect(readRequiredProjectAssetListFromStorage(storage, 'missing')).resolves.toEqual([]);
  });

  it('surfaces failed writes instead of claiming the asset was saved', async () => {
    const storage = {
      getItem: async () => null,
      removeItem: async () => undefined,
      setItem: async () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
    };

    await expect(writeProjectAssetListToStorage(storage, 'textures', [{ id: 'asset-1' }]))
      .rejects.toThrow('Quota exceeded');
  });

  it('requires configured signed-in accounts before custom local asset uploads', () => {
    expect(canUploadCustomLocalAssets({ authConfigured: true, isSignedIn: true })).toBe(true);
    expect(canUploadCustomLocalAssets({ authConfigured: true, isSignedIn: false })).toBe(false);
    expect(canUploadCustomLocalAssets({ authConfigured: false, isSignedIn: true })).toBe(false);
  });
});
