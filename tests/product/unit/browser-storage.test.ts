import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_STORAGE_DATABASE, BROWSER_STORAGE_SAVE_STATUS_EVENT, createBrowserKeyValueStorage, createIndexedDbStorage, getBrowserRecoverySnapshot, getBrowserWorkspaceSaveStatus, getBrowserStorageHealth, getConstrainedImageSize, validateLocalAssetFile } from '@/features/project/client/persistence-storage';
import { getBrowserWorkspaceRecoveryState, restoreBrowserWorkspaceRecovery, setProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { readProjectPreference, removeProjectPreference, writeProjectPreference } from '@/features/project/client/persistence-preferences';
import {
  getBrowserStoragePersistenceState,
  requestBrowserStoragePersistence,
} from '@/features/project/persistence/browserStoragePersistence';

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

  it('reports the real IndexedDB workspace write lifecycle', async () => {
    const statuses: string[] = [];
    const browser = new EventTarget();
    vi.stubGlobal('window', browser);
    try {
      browser.addEventListener(BROWSER_STORAGE_SAVE_STATUS_EVENT, (event) => {
        statuses.push((event as CustomEvent<string>).detail);
      });
      const workspace = createIndexedDbStorage('workspace-status', { trackWorkspaceSaveStatus: true });

      await workspace.setItem('state', '{"saved":true}');

      expect(statuses).toEqual(['saving', 'saved']);
      expect(getBrowserWorkspaceSaveStatus()).toBe('saved');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports a failed workspace write without pretending the change was saved', async () => {
    const statuses: string[] = [];
    const browser = new EventTarget();
    vi.stubGlobal('window', browser);
    vi.stubGlobal('indexedDB', {
      open: () => {
        const request = {
          error: new Error('Storage is full'),
          onerror: null as null | (() => void),
          onupgradeneeded: null,
          onsuccess: null,
        };
        queueMicrotask(() => request.onerror?.());
        return request;
      },
    });
    try {
      browser.addEventListener(BROWSER_STORAGE_SAVE_STATUS_EVENT, (event) => {
        statuses.push((event as CustomEvent<string>).detail);
      });
      const workspace = createIndexedDbStorage('workspace-status-failure', {
        suppressWriteErrors: true,
        trackWorkspaceSaveStatus: true,
      });

      await workspace.setItem('state', '{"saved":false}');

      expect(statuses).toEqual(['saving', 'failed']);
      expect(getBrowserWorkspaceSaveStatus()).toBe('failed');
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('offers a reversible restore of the previous scoped workspace copy', async () => {
    setProjectPersistenceScope('guest');
    const storage = createBrowserKeyValueStorage('project-workspace:guest', { keepRecoverySnapshot: true });
    await storage.setItem('workspace', '{"version":1}');
    await storage.setItem('workspace', '{"version":2}');

    expect(await getBrowserWorkspaceRecoveryState()).toEqual({
      currentAvailable: true,
      previousAvailable: true,
      quarantinedAvailable: false,
    });
    expect(await restoreBrowserWorkspaceRecovery('previous')).toBe(true);
    expect(await storage.getItem('workspace')).toBe('{"version":1}');
    expect(await storage.getItem('__recovery__:workspace')).toBe('{"version":2}');
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

  it('distinguishes unsupported, best-effort, and granted persistent browser storage', async () => {
    expect(await getBrowserStoragePersistenceState(null)).toBe('unsupported');

    const denied = { persisted: vi.fn(async () => false), persist: vi.fn(async () => false) };
    expect(await getBrowserStoragePersistenceState(denied)).toBe('best-effort');
    expect(await requestBrowserStoragePersistence(denied)).toBe('best-effort');
    expect(denied.persist).toHaveBeenCalledOnce();

    const granted = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) };
    expect(await requestBrowserStoragePersistence(granted)).toBe('persistent');
    expect(granted.persist).toHaveBeenCalledOnce();
  });

  it('reports StorageManager failures as unavailable without treating work as deleted', async () => {
    const unavailable = {
      persisted: vi.fn(async () => { throw new Error('Browser rejected the query'); }),
      persist: vi.fn(async () => true),
    };

    expect(await getBrowserStoragePersistenceState(unavailable)).toBe('unavailable');
    expect(await requestBrowserStoragePersistence(unavailable)).toBe('unavailable');
    expect(unavailable.persist).not.toHaveBeenCalled();
  });
});

describe('local artwork validation', () => {
  it('rejects unsupported types without imposing a CardForge storage quota', () => {
    expect(validateLocalAssetFile({ name: 'notes.txt', size: 100, type: 'text/plain' })).toEqual({
      ok: false,
      message: 'Choose a PNG, JPEG, WebP, GIF, or SVG image.',
    });
    expect(validateLocalAssetFile({
      name: 'huge.png',
      size: 80 * 1024 * 1024,
      type: 'image/png',
    })).toEqual({ ok: true });
  });

  it('accepts supported artwork', () => {
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
