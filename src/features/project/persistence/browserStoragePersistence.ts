export type BrowserStoragePersistenceState = 'unsupported' | 'unavailable' | 'persistent' | 'best-effort';

export interface BrowserStoragePersistenceManager {
  persisted: () => Promise<boolean>;
  persist: () => Promise<boolean>;
}

const currentStorageManager = (): BrowserStoragePersistenceManager | null => {
  if (typeof navigator === 'undefined') return null;
  const manager = navigator.storage as Partial<BrowserStoragePersistenceManager> | undefined;
  return manager && typeof manager.persisted === 'function' && typeof manager.persist === 'function'
    ? manager as BrowserStoragePersistenceManager
    : null;
};

export const getBrowserStoragePersistenceState = async (
  manager: BrowserStoragePersistenceManager | null = currentStorageManager(),
): Promise<BrowserStoragePersistenceState> => {
  if (!manager) return 'unsupported';
  try {
    return await manager.persisted() ? 'persistent' : 'best-effort';
  } catch {
    return 'unavailable';
  }
};

export const requestBrowserStoragePersistence = async (
  manager: BrowserStoragePersistenceManager | null = currentStorageManager(),
): Promise<BrowserStoragePersistenceState> => {
  if (!manager) return 'unsupported';
  try {
    if (await manager.persisted()) return 'persistent';
    return await manager.persist() ? 'persistent' : 'best-effort';
  } catch {
    return 'unavailable';
  }
};
