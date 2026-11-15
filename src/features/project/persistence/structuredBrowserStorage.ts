import { BROWSER_STORAGE_OBJECT_STORE, openBrowserStorageDatabase } from './indexedDbStorage';

const runStructuredRequest = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openBrowserStorageDatabase();
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

/** One native transaction for the artwork externalized from one workspace save. */
export const writeStructuredBrowserValues = async (values: ReadonlyMap<string, Blob>): Promise<void> => {
  if (!values.size) return;
  const database = await openBrowserStorageDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(BROWSER_STORAGE_OBJECT_STORE, 'readwrite');
      const store = transaction.objectStore(BROWSER_STORAGE_OBJECT_STORE);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save project artwork.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Project artwork transaction was aborted.'));
      try { for (const [key, value] of values) store.put(value, key); }
      catch (error) { transaction.abort(); reject(error); }
    });
  } finally { database.close(); }
};

export const removeStructuredBrowserValue = async (key: string): Promise<void> => {
  if (typeof indexedDB === 'undefined') return;
  await runStructuredRequest('readwrite', (store) => store.delete(key));
};
