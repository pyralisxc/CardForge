import type { StateStorage } from 'zustand/middleware';

import type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';
import { externalizeBrowserProjectAssetJson } from './contentAddressedBrowserAssets';
import {
  BROWSER_STORAGE_FAILURE_EVENT,
  compareAndSetBrowserWorkspaceValue,
  createBrowserKeyValueStorage,
  createIndexedDbStorage,
} from './indexedDbStorage';
import { BrowserWorkspaceConflictError, parseBrowserWorkspaceRecord } from './workspaceRevision';

export { createProjectPersistenceScope } from '../lib/projectPersistenceIdentity';
export type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';

const DISABLED_SCOPE = 'unscoped-disabled';
const MAX_WORKSPACE_JSON_LENGTH = 8 * 1024 * 1024;
let activeProjectPersistenceScope: ProjectPersistenceScope | typeof DISABLED_SCOPE = DISABLED_SCOPE;
const workspaceRevisions = new Map<string, number>();
const workspaceWriteQueues = new Map<string, Promise<void>>();
const workspaceWriterId = typeof globalThis.crypto?.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `writer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let workspaceRevisionChannel: BroadcastChannel | null = null;

export const BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT = 'cardforge:workspace-remote-change';

const getWorkspaceRevisionKey = (namespace: string, key: string) => `${namespace}:${key}`;

const enqueueWorkspaceWrite = async <Result>(
  revisionKey: string,
  write: () => Promise<Result>,
): Promise<Result> => {
  const previous = workspaceWriteQueues.get(revisionKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(write);
  const tail = current.then(() => undefined, () => undefined);
  workspaceWriteQueues.set(revisionKey, tail);
  try {
    return await current;
  } finally {
    if (workspaceWriteQueues.get(revisionKey) === tail) workspaceWriteQueues.delete(revisionKey);
  }
};

const getWorkspaceRevisionChannel = () => {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!workspaceRevisionChannel) {
    workspaceRevisionChannel = new BroadcastChannel('cardforge-workspace-revisions');
    workspaceRevisionChannel.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return;
      const message = event.data as Record<string, unknown>;
      if (message.writerId === workspaceWriterId
        || typeof message.namespace !== 'string'
        || typeof message.key !== 'string'
        || typeof message.revision !== 'number') return;
      if (message.namespace !== `project-workspace:${activeProjectPersistenceScope}`) return;
      const observed = workspaceRevisions.get(getWorkspaceRevisionKey(message.namespace, message.key)) ?? 0;
      if (message.revision <= observed || typeof window === 'undefined') return;
      window.dispatchEvent(new CustomEvent(BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT, { detail: message }));
    });
  }
  return workspaceRevisionChannel;
};

export const setProjectPersistenceScope = (scope: ProjectPersistenceScope) => {
  activeProjectPersistenceScope = scope;
};

export const getProjectPersistenceScope = () => activeProjectPersistenceScope;

export const getScopedProjectStorageNamespace = (
  baseNamespace: 'project-workspace' | 'project-assets',
  scope: ProjectPersistenceScope | typeof DISABLED_SCOPE = activeProjectPersistenceScope,
) => `${baseNamespace}:${scope}`;

export type BrowserWorkspaceRecoverySource = 'previous' | 'quarantine';

export interface BrowserWorkspaceRecoveryState {
  currentAvailable: boolean;
  previousAvailable: boolean;
  quarantinedAvailable: boolean;
}

const WORKSPACE_STORAGE_KEY = 'workspace';
const workspaceRecoveryKey = (source: BrowserWorkspaceRecoverySource) => (
  source === 'previous' ? `__recovery__:${WORKSPACE_STORAGE_KEY}` : `__quarantine__:${WORKSPACE_STORAGE_KEY}`
);

export const getBrowserWorkspaceRecoveryState = async (): Promise<BrowserWorkspaceRecoveryState> => {
  const namespace = getScopedProjectStorageNamespace('project-workspace');
  const storage = createBrowserKeyValueStorage(namespace);
  const [current, previous, quarantine] = await Promise.all([
    storage.getItem(WORKSPACE_STORAGE_KEY),
    storage.getItem(workspaceRecoveryKey('previous')),
    storage.getItem(workspaceRecoveryKey('quarantine')),
  ]);
  return {
    currentAvailable: typeof current === 'string',
    previousAvailable: typeof previous === 'string',
    quarantinedAvailable: typeof quarantine === 'string',
  };
};

export const restoreBrowserWorkspaceRecovery = async (source: BrowserWorkspaceRecoverySource): Promise<boolean> => {
  const namespace = getScopedProjectStorageNamespace('project-workspace');
  const storage = createBrowserKeyValueStorage(namespace);
  const recoveryValue = await storage.getItem(workspaceRecoveryKey(source));
  if (typeof recoveryValue !== 'string') return false;
  // The canonical current value becomes the new previous snapshot, so restore
  // remains reversible after the required reload.
  await createBrowserKeyValueStorage(namespace, { keepRecoverySnapshot: true })
    .setItem(WORKSPACE_STORAGE_KEY, recoveryValue);
  if (source === 'quarantine') await storage.removeItem(workspaceRecoveryKey(source));
  return true;
};

export const discardBrowserWorkspaceRecovery = async (source: BrowserWorkspaceRecoverySource): Promise<void> => {
  const namespace = getScopedProjectStorageNamespace('project-workspace');
  await createBrowserKeyValueStorage(namespace).removeItem(workspaceRecoveryKey(source));
};

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
    const scope = activeProjectPersistenceScope;
    const namespace = getScopedProjectStorageNamespace(baseNamespace, scope);
    const storage = createIndexedDbStorage(namespace, options);
    const rawValue = await storage.getItem(key);
    if (rawValue === null) {
      if (baseNamespace === 'project-workspace') {
        workspaceRevisions.set(getWorkspaceRevisionKey(namespace, key), 0);
        getWorkspaceRevisionChannel();
      }
      return null;
    }
    const record = baseNamespace === 'project-workspace'
      ? parseBrowserWorkspaceRecord(rawValue)
      : null;
    if (record) {
      workspaceRevisions.set(getWorkspaceRevisionKey(namespace, key), record.revision);
      getWorkspaceRevisionChannel();
    }
    const value = record?.value ?? rawValue;
    try {
      const externalized = await externalizeBrowserProjectAssetJson(value, scope);
      if (externalized.changed) {
        if (baseNamespace === 'project-workspace') {
          const expectedRevision = workspaceRevisions.get(getWorkspaceRevisionKey(namespace, key)) ?? 0;
          const revision = await compareAndSetBrowserWorkspaceValue({
            namespace,
            key,
            value: externalized.storedValue,
            expectedRevision,
            writerId: workspaceWriterId,
            keepRecoverySnapshot: options.keepRecoverySnapshot,
          });
          workspaceRevisions.set(getWorkspaceRevisionKey(namespace, key), revision);
        } else await storage.setItem(key, externalized.storedValue);
      }
      if (baseNamespace === 'project-workspace' && isValidWorkspacePayload(externalized.storedValue)) {
        return externalized.storedValue;
      }
      if (baseNamespace === 'project-assets') {
        return externalized.storedValue;
      }
    } catch {
      // The recovery copy below is authoritative when structured artwork or JSON
      // cannot be read safely. Never hydrate a partial/empty replacement.
    }

    // Preserve a recovery copy, but never let corrupt or pathological workspace JSON
    // enter Zustand hydration. The editor can then boot with clean defaults.
    await storage.setItem(`__quarantine__:${key}`, value);
    await storage.removeItem(key);
    return null;
  },
  setItem: async (key, value) => {
    const scope = activeProjectPersistenceScope;
    const externalized = await externalizeBrowserProjectAssetJson(value, scope);
    const namespace = getScopedProjectStorageNamespace(baseNamespace, scope);
    if (baseNamespace !== 'project-workspace') {
      await createIndexedDbStorage(namespace, options).setItem(key, externalized.storedValue);
      return;
    }
    const revisionKey = getWorkspaceRevisionKey(namespace, key);
    try {
      await enqueueWorkspaceWrite(revisionKey, async () => {
        const expectedRevision = workspaceRevisions.get(revisionKey) ?? 0;
        const revision = await compareAndSetBrowserWorkspaceValue({
          namespace,
          key,
          value: externalized.storedValue,
          expectedRevision,
          writerId: workspaceWriterId,
          keepRecoverySnapshot: options.keepRecoverySnapshot,
        });
        workspaceRevisions.set(revisionKey, revision);
        getWorkspaceRevisionChannel()?.postMessage({ namespace, key, revision, writerId: workspaceWriterId });
      });
    } catch (error) {
      if (!options.suppressWriteErrors) throw error;
      if (typeof window !== 'undefined' && !(error instanceof BrowserWorkspaceConflictError)) {
        window.dispatchEvent(new CustomEvent(BROWSER_STORAGE_FAILURE_EVENT, {
          detail: { message: error instanceof Error ? error.message : 'Browser storage rejected the save.' },
        }));
      }
    }
  },
  removeItem: (key) => createIndexedDbStorage(
    getScopedProjectStorageNamespace(baseNamespace),
    options,
  ).removeItem(key),
});

export const LEGACY_PROJECT_WORKSPACE_NAMESPACE = 'project-workspace';
export const LEGACY_PROJECT_ASSETS_NAMESPACE = 'project-assets';
