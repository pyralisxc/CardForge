import type { StateStorage } from 'zustand/middleware';

import type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';
import { createIndexedDbStorage } from './indexedDbStorage';

export { createProjectPersistenceScope } from '../lib/projectPersistenceIdentity';
export type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';

const DISABLED_SCOPE = 'unscoped-disabled';
const MAX_WORKSPACE_JSON_LENGTH = 8 * 1024 * 1024;
let activeProjectPersistenceScope: ProjectPersistenceScope | typeof DISABLED_SCOPE = DISABLED_SCOPE;

export const setProjectPersistenceScope = (scope: ProjectPersistenceScope) => {
  activeProjectPersistenceScope = scope;
};

export const getProjectPersistenceScope = () => activeProjectPersistenceScope;

export const getScopedProjectStorageNamespace = (
  baseNamespace: 'project-workspace' | 'project-assets',
  scope: ProjectPersistenceScope | typeof DISABLED_SCOPE = activeProjectPersistenceScope,
) => `${baseNamespace}:${scope}`;

const isValidWorkspacePayload = (value: string) => {
  if (value.length > MAX_WORKSPACE_JSON_LENGTH) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
};

export const createScopedProjectStorage = (
  baseNamespace: 'project-workspace' | 'project-assets',
  options: Parameters<typeof createIndexedDbStorage>[1] = {},
): StateStorage => ({
  getItem: async (key) => {
    const storage = createIndexedDbStorage(getScopedProjectStorageNamespace(baseNamespace), options);
    const value = await storage.getItem(key);
    if (baseNamespace !== 'project-workspace' || value === null || isValidWorkspacePayload(value)) {
      return value;
    }

    // Preserve a recovery copy, but never let corrupt or pathological workspace JSON
    // enter Zustand hydration. The editor can then boot with clean defaults.
    await storage.setItem(`__quarantine__:${key}`, value);
    await storage.removeItem(key);
    return null;
  },
  setItem: (key, value) => createIndexedDbStorage(
    getScopedProjectStorageNamespace(baseNamespace),
    options,
  ).setItem(key, value),
  removeItem: (key) => createIndexedDbStorage(
    getScopedProjectStorageNamespace(baseNamespace),
    options,
  ).removeItem(key),
});

export const LEGACY_PROJECT_WORKSPACE_NAMESPACE = 'project-workspace';
export const LEGACY_PROJECT_ASSETS_NAMESPACE = 'project-assets';
