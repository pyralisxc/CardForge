import { createIndexedDbStorage } from './indexedDbStorage';

const PREFERENCE_NAMESPACE = 'project-preferences';

const getPreferenceStorage = () => createIndexedDbStorage(
  PREFERENCE_NAMESPACE,
  { suppressWriteErrors: true },
);

export type ProjectPreferenceReadResult<T> =
  | { kind: 'missing' }
  | { kind: 'available'; value: T }
  | { kind: 'unavailable' };

/**
 * Preference consumers that might write a default must distinguish a missing
 * record from an unreadable one. An unavailable record is left untouched.
 */
export const readProjectPreferenceSafely = async <T>(key: string): Promise<ProjectPreferenceReadResult<T>> => {
  try {
    const raw = await getPreferenceStorage().getItem(key);
    if (raw === null) return { kind: 'missing' };
    return { kind: 'available', value: JSON.parse(raw) as T };
  } catch {
    return { kind: 'unavailable' };
  }
};

export const readProjectPreference = async <T>(key: string): Promise<T | null> => {
  const result = await readProjectPreferenceSafely<T>(key);
  return result.kind === 'available' ? result.value : null;
};

export const writeProjectPreference = async <T>(key: string, value: T): Promise<void> => {
  await getPreferenceStorage().setItem(key, JSON.stringify(value));
};

export const removeProjectPreference = async (key: string): Promise<void> => {
  await getPreferenceStorage().removeItem(key);
};
