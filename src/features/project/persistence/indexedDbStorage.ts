import type { StateStorage } from 'zustand/middleware';

import {
  BrowserWorkspaceConflictError,
  parseBrowserWorkspaceRecord,
  serializeBrowserWorkspaceRecord,
} from './workspaceRevision';

export const BROWSER_STORAGE_DATABASE = 'cardforge-browser-storage';
export const BROWSER_STORAGE_FAILURE_EVENT = 'cardforge:browser-storage-failure';
export const BROWSER_STORAGE_SAVE_STATUS_EVENT = 'cardforge:workspace-save-status';
export const BROWSER_WORKSPACE_CONFLICT_EVENT = 'cardforge:workspace-conflict';
const BROWSER_STORAGE_OBJECT_STORE = 'key-value';
const BROWSER_STORAGE_VERSION = 1;
export const MAX_LOCAL_ASSET_DIMENSION = 8192;
const OPTIMIZED_LOCAL_ASSET_DIMENSION = 2400;
const OPTIMIZE_LOCAL_ASSET_THRESHOLD_BYTES = 2 * 1024 * 1024;

interface StorageEstimator {
  estimate: () => Promise<{ quota?: number; usage?: number }>;
}

export interface BrowserStorageHealth {
  level: 'unavailable' | 'healthy' | 'warning' | 'critical';
  quotaBytes: number | null;
  remainingBytes: number | null;
  usageBytes: number | null;
  usageRatio: number | null;
}

export type BrowserStorageSaveStatus = 'saving' | 'saved' | 'failed';

let pendingWorkspaceWrites = 0;
let workspaceSaveStatus: BrowserStorageSaveStatus = 'saved';

const publishWorkspaceSaveStatus = (status: BrowserStorageSaveStatus) => {
  workspaceSaveStatus = status;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BROWSER_STORAGE_SAVE_STATUS_EVENT, { detail: status }));
  }
};

export const getBrowserWorkspaceSaveStatus = () => workspaceSaveStatus;

export const subscribeToBrowserWorkspaceSaveStatus = (listener: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(BROWSER_STORAGE_SAVE_STATUS_EVENT, listener);
  return () => window.removeEventListener(BROWSER_STORAGE_SAVE_STATUS_EVENT, listener);
};

const beginWorkspaceWrite = () => {
  pendingWorkspaceWrites += 1;
  publishWorkspaceSaveStatus('saving');
};

const finishWorkspaceWrite = (didFail: boolean) => {
  pendingWorkspaceWrites = Math.max(0, pendingWorkspaceWrites - 1);
  if (didFail) {
    publishWorkspaceSaveStatus('failed');
    return;
  }
  if (pendingWorkspaceWrites === 0 && workspaceSaveStatus !== 'failed') {
    publishWorkspaceSaveStatus('saved');
  }
};

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('IndexedDB is unavailable in this browser.'));
    return;
  }

  const request = indexedDB.open(BROWSER_STORAGE_DATABASE, BROWSER_STORAGE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(BROWSER_STORAGE_OBJECT_STORE)) {
      request.result.createObjectStore(BROWSER_STORAGE_OBJECT_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Unable to open browser storage.'));
});

const runRequest = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(BROWSER_STORAGE_OBJECT_STORE, mode);
    const request = action(transaction.objectStore(BROWSER_STORAGE_OBJECT_STORE));
    request.onerror = () => reject(request.error ?? new Error('Browser storage request failed.'));
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Browser storage transaction was aborted.'));
    };
  });
};

const setBrowserValue = async ({
  key,
  value,
  recoveryKey,
}: {
  key: string;
  value: string;
  recoveryKey?: string;
}): Promise<void> => {
  if (!recoveryKey) {
    await runRequest('readwrite', (store) => store.put(value, key));
    return;
  }

  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BROWSER_STORAGE_OBJECT_STORE, 'readwrite');
    const store = transaction.objectStore(BROWSER_STORAGE_OBJECT_STORE);
    const previousRequest = store.get(key);
    previousRequest.onsuccess = () => {
      if (typeof previousRequest.result === 'string') {
        store.put(previousRequest.result, recoveryKey);
      }
      store.put(value, key);
    };
    previousRequest.onerror = () => reject(previousRequest.error ?? new Error('Unable to read the previous browser value.'));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Unable to save browser data.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Browser storage transaction was aborted.'));
    };
  });
};

export const createBrowserKeyValueStorage = (
  namespace: string,
  { keepRecoverySnapshot = false }: { keepRecoverySnapshot?: boolean } = {},
): StateStorage => {
  const namespacedKey = (key: string) => `${namespace}:${key}`;

  return {
    getItem: async (key) => {
      const value = await runRequest<string | undefined>(
        'readonly',
        (store) => store.get(namespacedKey(key)),
      );
      return value ?? null;
    },
    setItem: async (key, value) => {
      await setBrowserValue({
        key: namespacedKey(key),
        value,
        recoveryKey: keepRecoverySnapshot ? `${namespace}:__recovery__:${key}` : undefined,
      });
    },
    removeItem: async (key) => {
      await runRequest('readwrite', (store) => store.delete(namespacedKey(key)));
    },
  };
};

export const compareAndSetBrowserWorkspaceValue = async ({
  namespace,
  key,
  value,
  expectedRevision,
  writerId,
  keepRecoverySnapshot = false,
}: {
  namespace: string;
  key: string;
  value: string;
  expectedRevision: number;
  writerId: string;
  keepRecoverySnapshot?: boolean;
}): Promise<number> => {
  const namespacedKey = `${namespace}:${key}`;
  beginWorkspaceWrite();
  const database = await openDatabase();
  try {
    const revision = await new Promise<number>((resolve, reject) => {
      const transaction = database.transaction(BROWSER_STORAGE_OBJECT_STORE, 'readwrite');
      const store = transaction.objectStore(BROWSER_STORAGE_OBJECT_STORE);
      const request = store.get(namespacedKey);
      let nextRevision: number | null = null;
      let conflict: BrowserWorkspaceConflictError | null = null;
      request.onsuccess = () => {
        const previousRaw = typeof request.result === 'string' ? request.result : null;
        const previous = previousRaw === null
          ? { revision: 0 }
          : parseBrowserWorkspaceRecord(previousRaw);
        if (previous.revision !== expectedRevision) {
          conflict = new BrowserWorkspaceConflictError(expectedRevision, previous.revision);
          return;
        }
        nextRevision = previous.revision + 1;
        if (keepRecoverySnapshot && previousRaw !== null) {
          store.put(previousRaw, `${namespace}:__recovery__:${key}`);
        }
        store.put(serializeBrowserWorkspaceRecord({ revision: nextRevision, writerId, value }), namespacedKey);
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to read the current browser workspace revision.'));
      transaction.oncomplete = () => {
        if (conflict) reject(conflict);
        else if (nextRevision !== null) resolve(nextRevision);
        else reject(new Error('The browser workspace transaction did not produce a revision.'));
      };
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save browser data.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Browser storage transaction was aborted.'));
    });
    finishWorkspaceWrite(false);
    return revision;
  } catch (error) {
    finishWorkspaceWrite(true);
    if (typeof window !== 'undefined' && error instanceof BrowserWorkspaceConflictError) {
      window.dispatchEvent(new CustomEvent(BROWSER_WORKSPACE_CONFLICT_EVENT, { detail: error }));
    }
    throw error;
  } finally {
    database.close();
  }
};

export const quarantineBrowserStorageValue = async ({
  namespace,
  key,
  quarantineNamespace,
}: {
  namespace: string;
  key: string;
  quarantineNamespace: string;
}): Promise<boolean> => {
  const source = createBrowserKeyValueStorage(namespace);
  const value = await source.getItem(key);
  if (typeof value !== 'string') return false;

  const quarantine = createBrowserKeyValueStorage(quarantineNamespace);
  await quarantine.setItem(`${Date.now()}:${key}`, value);
  await source.removeItem(key);
  return true;
};

export const getBrowserRecoverySnapshot = async (namespace: string, key: string): Promise<string | null> => {
  const storage = createBrowserKeyValueStorage(namespace);
  return storage.getItem(`__recovery__:${key}`);
};

export const createIndexedDbStorage = (
  namespace: string,
  options: { keepRecoverySnapshot?: boolean; suppressWriteErrors?: boolean; trackWorkspaceSaveStatus?: boolean } = {},
): StateStorage => {
  if (typeof indexedDB === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }

  const indexedDbStorage = createBrowserKeyValueStorage(namespace, options);

  const reportWriteFailure = (error: unknown) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(BROWSER_STORAGE_FAILURE_EVENT, {
        detail: { message: error instanceof Error ? error.message : 'Browser storage rejected the save.' },
      }));
    }
  };

  return {
    getItem: async (key) => {
      return indexedDbStorage.getItem(key);
    },
    setItem: async (key, value) => {
      if (options.trackWorkspaceSaveStatus) beginWorkspaceWrite();
      try {
        await indexedDbStorage.setItem(key, value);
      } catch (error) {
        reportWriteFailure(error);
        if (options.trackWorkspaceSaveStatus) finishWorkspaceWrite(true);
        if (!options.suppressWriteErrors) throw error;
        return;
      }
      if (options.trackWorkspaceSaveStatus) finishWorkspaceWrite(false);
    },
    removeItem: async (key) => {
      await indexedDbStorage.removeItem(key);
    },
  };
};

export const getBrowserStorageHealth = async (
  estimator: StorageEstimator | undefined = typeof navigator !== 'undefined'
    ? navigator.storage
    : undefined,
): Promise<BrowserStorageHealth> => {
  if (!estimator?.estimate) {
    return {
      level: 'unavailable',
      quotaBytes: null,
      remainingBytes: null,
      usageBytes: null,
      usageRatio: null,
    };
  }

  const estimate = await estimator.estimate();
  const quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null;
  const usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null;
  if (!quotaBytes || usageBytes === null) {
    return {
      level: 'unavailable',
      quotaBytes,
      remainingBytes: null,
      usageBytes,
      usageRatio: null,
    };
  }

  const usageRatio = usageBytes / quotaBytes;
  return {
    level: usageRatio >= 0.9 ? 'critical' : usageRatio >= 0.75 ? 'warning' : 'healthy',
    quotaBytes,
    remainingBytes: Math.max(0, quotaBytes - usageBytes),
    usageBytes,
    usageRatio,
  };
};

export const validateLocalAssetFile = ({
  type,
}: Pick<File, 'name' | 'size' | 'type'>):
  | { ok: true }
  | { ok: false; message: string } => {
  const supportedTypes = new Set([
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/webp',
  ]);
  if (!supportedTypes.has(type.toLowerCase())) {
    return { ok: false, message: 'Choose a PNG, JPEG, WebP, GIF, or SVG image.' };
  }
  return { ok: true };
};

export const getConstrainedImageSize = ({
  width,
  height,
  maxDimension,
}: {
  width: number;
  height: number;
  maxDimension: number;
}) => {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const optimizeLocalAssetFile = async (file: File): Promise<File> => {
  if (
    (file.type !== 'image/jpeg' && file.type !== 'image/png' && file.type !== 'image/webp')
    || typeof createImageBitmap === 'undefined'
  ) return file;

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > MAX_LOCAL_ASSET_DIMENSION || bitmap.height > MAX_LOCAL_ASSET_DIMENSION) {
      throw new Error(`Artwork dimensions must be ${MAX_LOCAL_ASSET_DIMENSION}px or smaller.`);
    }
    if (
      file.size <= OPTIMIZE_LOCAL_ASSET_THRESHOLD_BYTES
      && bitmap.width <= OPTIMIZED_LOCAL_ASSET_DIMENSION
      && bitmap.height <= OPTIMIZED_LOCAL_ASSET_DIMENSION
    ) return file;

    const size = getConstrainedImageSize({
      width: bitmap.width,
      height: bitmap.height,
      maxDimension: OPTIMIZED_LOCAL_ASSET_DIMENSION,
    });
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/webp';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: outputType, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
};
