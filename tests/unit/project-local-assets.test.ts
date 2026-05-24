import { describe, expect, it } from 'vitest';

import {
  canUploadCustomLocalAssets,
  readProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from '@/features/project/lib/projectLocalAssets';

const createStorage = (initial: Record<string, string | null> = {}) => {
  const values = new Map(Object.entries(initial).filter((entry): entry is [string, string] => entry[1] !== null));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
};

describe('projectLocalAssets', () => {
  it('reads arrays from storage and returns empty arrays for missing or invalid values', () => {
    const storage = createStorage({
      textures: JSON.stringify([{ id: 'asset-1' }]),
      invalid: '{not json',
      object: JSON.stringify({ id: 'not-array' }),
    });

    expect(readProjectAssetListFromStorage(storage, 'textures')).toEqual([{ id: 'asset-1' }]);
    expect(readProjectAssetListFromStorage(storage, 'missing')).toEqual([]);
    expect(readProjectAssetListFromStorage(storage, 'invalid')).toEqual([]);
    expect(readProjectAssetListFromStorage(storage, 'object')).toEqual([]);
  });

  it('writes asset arrays back to storage as JSON', () => {
    const storage = createStorage();

    writeProjectAssetListToStorage(storage, 'textures', [{ id: 'asset-1' }]);

    expect(storage.getItem('textures')).toBe(JSON.stringify([{ id: 'asset-1' }]));
  });

  it('requires configured signed-in accounts before custom local asset uploads', () => {
    expect(canUploadCustomLocalAssets({ authConfigured: true, isSignedIn: true })).toBe(true);
    expect(canUploadCustomLocalAssets({ authConfigured: true, isSignedIn: false })).toBe(false);
    expect(canUploadCustomLocalAssets({ authConfigured: false, isSignedIn: true })).toBe(false);
  });
});
