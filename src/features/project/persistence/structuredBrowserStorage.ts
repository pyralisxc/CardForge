import { BROWSER_STORAGE_DATABASE } from './indexedDbStorage';

const BROWSER_STORAGE_OBJECT_STORE = 'key-value';
const BROWSER_STORAGE_VERSION = 1;

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

const runStructuredRequest = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openDatabase();
  return await new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(BROWSER_STORAGE_OBJECT_STORE, mode);
    const request = action(transaction.objectStore(BROWSER_STORAGE_OBJECT_STORE));
    request.onerror = () => reject(request.error ?? new Error('Browser storage request failed.'));
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Browser storage transaction failed.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Browser storage transaction was aborted.'));
    };
  });
};

export const readStructuredBrowserValue = async <T>(key: string): Promise<T | null> => {
  if (typeof indexedDB === 'undefined') return null;
  const value = await runStructuredRequest<T | undefined>('readonly', (store) => store.get(key));
  return value ?? null;
};

export const writeStructuredBrowserValue = async <T>(key: string, value: T): Promise<void> => {
  await runStructuredRequest('readwrite', (store) => store.put(value, key));
};

export const removeStructuredBrowserValue = async (key: string): Promise<void> => {
  if (typeof indexedDB === 'undefined') return;
  await runStructuredRequest('readwrite', (store) => store.delete(key));
};
