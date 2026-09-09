import type { StateStorage } from 'zustand/middleware';

import type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';
import { CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_FONT_ASSETS_STORAGE_KEY } from '../model/projectDocument';
import { externalizeBrowserProjectAssetJson } from './contentAddressedBrowserAssets';
import {
  BROWSER_STORAGE_FAILURE_EVENT,
  compareAndSetBrowserWorkspaceValue,
  createBrowserKeyValueStorage,
  createIndexedDbStorage,
  updateBrowserKeyValue,
  markBrowserWorkspaceSaveFailed,
} from './indexedDbStorage';
import { BrowserWorkspaceConflictError, parseBrowserWorkspaceRecord } from './workspaceRevision';

export { createProjectPersistenceScope } from '../lib/projectPersistenceIdentity';
export type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';

const DISABLED_SCOPE = 'unscoped-disabled';
let activeProjectPersistenceScope: ProjectPersistenceScope | typeof DISABLED_SCOPE = DISABLED_SCOPE;
const workspaceRevisions = new Map<string, number>();
const workspaceWriteQueues = new Map<string, Promise<void>>();
const restoredWorkspaces = new Set<string>();
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
const workspaceAssetKeys = (scope: ProjectPersistenceScope | typeof DISABLED_SCOPE) => [
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_FONT_ASSETS_STORAGE_KEY,
].map((key) => `${getScopedProjectStorageNamespace('project-assets', scope)}:${key}`);
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
  const scope = activeProjectPersistenceScope;
  const namespace = getScopedProjectStorageNamespace('project-workspace', scope);
  const revisionKey = getWorkspaceRevisionKey(namespace, WORKSPACE_STORAGE_KEY);
  return enqueueWorkspaceWrite(revisionKey, async () => {
    const storage = createBrowserKeyValueStorage(namespace);
    const recoveryValue = await storage.getItem(workspaceRecoveryKey(source));
    if (typeof recoveryValue !== 'string') return false;
    const value = parseBrowserWorkspaceRecord(recoveryValue).value;
    if (!isValidWorkspacePayload(value)) throw new Error('This recovery copy is not readable workspace JSON. Download the preserved bytes instead.');
    const current = await storage.getItem(WORKSPACE_STORAGE_KEY);
    const recoveryAssets = source === 'previous' ? await storage.getItem('__recovery_assets__:workspace') : null;
    const assetNamespace = getScopedProjectStorageNamespace('project-assets', scope);
    const assetStorage = createBrowserKeyValueStorage(assetNamespace);
    const allowedKeys = workspaceAssetKeys(scope);
    const assetValues = recoveryAssets === null ? {} : JSON.parse(recoveryAssets) as Record<string, unknown>;
    const relatedWrites = await Promise.all(Object.entries(assetValues).map(async ([key, value]) => {
      if (!allowedKeys.includes(key) || (value !== null && typeof value !== 'string')) throw new Error('The recovery artwork catalog is invalid. Original copies were left unchanged.');
      return { key, value: value as string | null, expectedValue: await assetStorage.getItem(key.slice(assetNamespace.length + 1)) };
    }));
    const expectedRevision = workspaceRevisions.get(revisionKey)
      ?? (current === null ? 0 : parseBrowserWorkspaceRecord(current).revision);
    const revision = await compareAndSetBrowserWorkspaceValue({
      namespace, key: WORKSPACE_STORAGE_KEY, value, expectedRevision,
      writerId: workspaceWriterId, keepRecoverySnapshot: true,
      relatedWrites, recoveryKeys: allowedKeys,
      beforeCommit: () => {
        if (activeProjectPersistenceScope !== scope) throw new Error('The workspace account changed while recovery was opening. No copy was restored.');
      },
    });
    workspaceRevisions.set(revisionKey, revision);
    restoredWorkspaces.add(revisionKey);
    getWorkspaceRevisionChannel()?.postMessage({ namespace, key: WORKSPACE_STORAGE_KEY, revision, writerId: workspaceWriterId });
    // Quarantine is retained until explicitly discarded, including after restore.
    return true;
  });
};

export const discardBrowserWorkspaceRecovery = async (source: BrowserWorkspaceRecoverySource): Promise<void> => {
  const namespace = getScopedProjectStorageNamespace('project-workspace');
  await createBrowserKeyValueStorage(namespace).removeItem(workspaceRecoveryKey(source));
};

/** Exact preservation export; this is recovery data, not an editable project package. */
export const readBrowserWorkspaceRecovery = async (source: BrowserWorkspaceRecoverySource | 'current'): Promise<string | null> => (
  createBrowserKeyValueStorage(getScopedProjectStorageNamespace('project-workspace'))
    .getItem(source === 'current' ? WORKSPACE_STORAGE_KEY : workspaceRecoveryKey(source))
);

const isValidWorkspacePayload = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
    const state = (parsed as Record<string, unknown>).state;
    return typeof state === 'object' && state !== null && !Array.isArray(state);
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
    if (baseNamespace === 'project-workspace' && !isValidWorkspacePayload(value)) {
      // Never delete the source or overwrite an earlier unreadable recovery copy.
      // This write deliberately bypasses the autosave adapter's error suppression.
      await updateBrowserKeyValue(namespace, `__quarantine__:${key}`, (existing) => existing ?? rawValue);
      throw new Error('The saved browser workspace is unreadable. Its original bytes are preserved; restore a previous copy or download recovery data.');
    }
    // Asset I/O, invalid artwork and revision conflicts are not JSON corruption.
    // Propagate them without changing the current or quarantined workspace.
    const externalized = await externalizeBrowserProjectAssetJson(value, scope);
    if (externalized.changed) {
      if (baseNamespace === 'project-workspace') {
        const revisionKey = getWorkspaceRevisionKey(namespace, key);
        await enqueueWorkspaceWrite(revisionKey, async () => {
          const revision = await compareAndSetBrowserWorkspaceValue({
            namespace, key, value: externalized.storedValue,
            expectedRevision: record?.revision ?? 0,
            writerId: workspaceWriterId,
            keepRecoverySnapshot: options.keepRecoverySnapshot,
            recoveryKeys: workspaceAssetKeys(scope),
          });
          workspaceRevisions.set(revisionKey, revision);
          getWorkspaceRevisionChannel()?.postMessage({ namespace, key, revision, writerId: workspaceWriterId });
        });
      } else {
        return await updateBrowserKeyValue(namespace, key, (current) => {
          if (current === null) throw new Error('The local artwork library changed. Reload it and try again.');
          return current === rawValue ? externalized.storedValue : current;
        });
      }
    }
    return externalized.storedValue;
  },
  setItem: async (key, value) => {
    const scope = activeProjectPersistenceScope;
    const namespace = getScopedProjectStorageNamespace(baseNamespace, scope);
    if (baseNamespace !== 'project-workspace') {
      const externalized = await externalizeBrowserProjectAssetJson(value, scope);
      await createIndexedDbStorage(namespace, options).setItem(key, externalized.storedValue);
      return;
    }
    const revisionKey = getWorkspaceRevisionKey(namespace, key);
    try {
      await enqueueWorkspaceWrite(revisionKey, async () => {
        if (restoredWorkspaces.has(revisionKey)) throw new Error('This workspace was restored. Reload before editing or saving again.');
        if (!isValidWorkspacePayload(value)) throw new Error('Browser workspace must contain readable JSON before it can be saved.');
        const externalized = await externalizeBrowserProjectAssetJson(value, scope);
        const expectedRevision = workspaceRevisions.get(revisionKey) ?? 0;
        const revision = await compareAndSetBrowserWorkspaceValue({
          namespace,
          key,
          value: externalized.storedValue,
          expectedRevision,
          writerId: workspaceWriterId,
          keepRecoverySnapshot: options.keepRecoverySnapshot,
          recoveryKeys: workspaceAssetKeys(scope),
        });
        workspaceRevisions.set(revisionKey, revision);
        getWorkspaceRevisionChannel()?.postMessage({ namespace, key, revision, writerId: workspaceWriterId });
      });
    } catch (error) {
      markBrowserWorkspaceSaveFailed();
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

/** One native commit for imported workspace state and its asset catalogs. */
export const commitBrowserWorkspaceImport = async ({ value, relatedWrites, beforeCommit, signal }: {
  value: string;
  relatedWrites: readonly { key: string; value: string; expectedValue: string | null }[];
  beforeCommit: () => void;
  signal: AbortSignal;
}): Promise<void> => {
  const scope = activeProjectPersistenceScope;
  const namespace = getScopedProjectStorageNamespace('project-workspace', scope);
  const revisionKey = getWorkspaceRevisionKey(namespace, WORKSPACE_STORAGE_KEY);
  await enqueueWorkspaceWrite(revisionKey, async () => {
    if (!isValidWorkspacePayload(value)) throw new Error('The imported workspace is not readable JSON.');
    if (restoredWorkspaces.has(revisionKey)) throw new Error('Reload the restored workspace before opening another project.');
    const externalized = await externalizeBrowserProjectAssetJson(value, scope);
    const revision = await compareAndSetBrowserWorkspaceValue({
      namespace, key: WORKSPACE_STORAGE_KEY, value: externalized.storedValue,
      expectedRevision: workspaceRevisions.get(revisionKey) ?? 0,
      writerId: workspaceWriterId, keepRecoverySnapshot: true,
      relatedWrites, recoveryKeys: workspaceAssetKeys(scope),
      signal,
      beforeCommit: () => {
        if (activeProjectPersistenceScope !== scope) throw new Error('The workspace account changed while this project was opening.');
        beforeCommit();
      },
    });
    workspaceRevisions.set(revisionKey, revision);
    getWorkspaceRevisionChannel()?.postMessage({ namespace, key: WORKSPACE_STORAGE_KEY, revision, writerId: workspaceWriterId });
  });
};

export const LEGACY_PROJECT_WORKSPACE_NAMESPACE = 'project-workspace';
export const LEGACY_PROJECT_ASSETS_NAMESPACE = 'project-assets';
