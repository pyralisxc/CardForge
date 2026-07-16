import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BROWSER_STORAGE_DATABASE,
  createBrowserKeyValueStorage,
  createIndexedDbStorage,
  getBrowserRecoverySnapshot,
  getBrowserStorageHealth,
  getConstrainedImageSize,
  readProjectPreference,
  removeProjectPreference,
  validateLocalAssetFile,
  writeProjectPreference,
} from '@/features/project/client';

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

  it('keeps independent project namespaces isolated', async () => {
    const workspace = createIndexedDbStorage('workspace');
    const assets = createIndexedDbStorage('assets');
    await workspace.setItem('state', '{"kind":"workspace"}');
    await assets.setItem('state', '{"kind":"assets"}');

    expect(await workspace.getItem('state')).toBe('{"kind":"workspace"}');
    expect(await assets.getItem('state')).toBe('{"kind":"assets"}');
  });

  it('uses an inert adapter during server rendering when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      const storage = createIndexedDbStorage('server-render');

      expect(await storage.getItem('workspace')).toBeNull();
      expect(await storage.setItem('workspace', '{"ignored":true}')).toBeUndefined();
      expect(await storage.removeItem('workspace')).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the previous workspace value as an automatic recovery snapshot', async () => {
    const storage = createBrowserKeyValueStorage('recoverable', { keepRecoverySnapshot: true });
    await storage.setItem('workspace', '{"version":1}');
    await storage.setItem('workspace', '{"version":2}');
    expect(await getBrowserRecoverySnapshot('recoverable', 'workspace')).toBe('{"version":1}');
    expect(await storage.getItem('workspace')).toBe('{"version":2}');
  });

  it('round-trips typed browser preferences through the Project namespace', async () => {
    await writeProjectPreference('layout-palette', ['save-template', 'add-text']);
    expect(await readProjectPreference<string[]>('layout-palette')).toEqual(['save-template', 'add-text']);

    await removeProjectPreference('layout-palette');
    expect(await readProjectPreference<string[]>('layout-palette')).toBeNull();
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
