import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  BROWSER_STORAGE_DATABASE,
  createBrowserKeyValueStorage,
  createMigratingBrowserStorage,
  getBrowserRecoverySnapshot,
  getBrowserStorageHealth,
  getConstrainedImageSize,
  validateLocalAssetFile,
} from '@/features/project/lib/browserStorage';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

describe('browser IndexedDB storage', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  it('round-trips and removes persisted values', async () => {
    const storage = createBrowserKeyValueStorage('test-state');

    await storage.setItem('workspace', '{"card":"example"}');
    expect(await storage.getItem('workspace')).toBe('{"card":"example"}');

    await storage.removeItem('workspace');
    expect(await storage.getItem('workspace')).toBeNull();
  });

  it('moves a legacy localStorage value only after IndexedDB accepts it', async () => {
    const legacyValues = new Map([['workspace', '{"legacy":true}']]);
    const storage = createMigratingBrowserStorage('migration-test', {
      getItem: (key) => legacyValues.get(key) ?? null,
      removeItem: (key) => {
        legacyValues.delete(key);
      },
      setItem: (key, value) => {
        legacyValues.set(key, value);
      },
    });

    expect(await storage.getItem('workspace')).toBe('{"legacy":true}');
    expect(legacyValues.has('workspace')).toBe(false);
    expect(await storage.getItem('workspace')).toBe('{"legacy":true}');
  });

  it('keeps the previous workspace value as an automatic recovery snapshot', async () => {
    const storage = createBrowserKeyValueStorage('recoverable', { keepRecoverySnapshot: true });
    await storage.setItem('workspace', '{"version":1}');
    await storage.setItem('workspace', '{"version":2}');
    expect(await getBrowserRecoverySnapshot('recoverable', 'workspace')).toBe('{"version":1}');
    expect(await storage.getItem('workspace')).toBe('{"version":2}');
  });

  it('reports quota pressure before a write', async () => {
    const healthy = await getBrowserStorageHealth({
      estimate: async () => ({ quota: 10_000, usage: 1_000 }),
    });
    const pressured = await getBrowserStorageHealth({
      estimate: async () => ({ quota: 10_000, usage: 9_500 }),
    });

    expect(healthy.level).toBe('healthy');
    expect(pressured.level).toBe('critical');
    expect(pressured.remainingBytes).toBe(500);
  });
});

describe('local artwork validation', () => {
  it('rejects unsupported types and files larger than eight MiB', () => {
    expect(validateLocalAssetFile({ name: 'notes.txt', size: 100, type: 'text/plain' })).toEqual({
      ok: false,
      message: 'Choose a PNG, JPEG, WebP, GIF, or SVG image.',
    });
    expect(validateLocalAssetFile({
      name: 'huge.png',
      size: 8 * 1024 * 1024 + 1,
      type: 'image/png',
    })).toEqual({
      ok: false,
      message: 'Artwork must be 8 MB or smaller.',
    });
  });

  it('accepts supported artwork within the limit', () => {
    expect(validateLocalAssetFile({
      name: 'art.webp',
      size: 500_000,
      type: 'image/webp',
    })).toEqual({ ok: true });
  });

  it('constrains large raster dimensions without changing aspect ratio', () => {
    expect(getConstrainedImageSize({ width: 6000, height: 3000, maxDimension: 2400 })).toEqual({
      width: 2400,
      height: 1200,
    });
    expect(getConstrainedImageSize({ width: 1200, height: 900, maxDimension: 2400 })).toEqual({
      width: 1200,
      height: 900,
    });
  });
});
