import { createIndexedDbStorage } from './indexedDbStorage';

const PREFERENCE_NAMESPACE = 'project-preferences';

const getPreferenceStorage = () => createIndexedDbStorage(
  PREFERENCE_NAMESPACE,
  { suppressWriteErrors: true },
);

export const readProjectPreference = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await getPreferenceStorage().getItem(key);
    return raw === null ? null : JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeProjectPreference = async <T>(key: string, value: T): Promise<void> => {
  await getPreferenceStorage().setItem(key, JSON.stringify(value));
};

export const removeProjectPreference = async (key: string): Promise<void> => {
  await getPreferenceStorage().removeItem(key);
};
