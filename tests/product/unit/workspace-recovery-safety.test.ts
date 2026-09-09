import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_STORAGE_DATABASE, compareAndSetBrowserWorkspaceValue, createBrowserKeyValueStorage, getBrowserWorkspaceSaveStatus } from '@/features/project/persistence/indexedDbStorage';
import { createScopedProjectStorage, restoreBrowserWorkspaceRecovery, setProjectPersistenceScope } from '@/features/project/persistence/projectPersistenceScope';
import { BrowserWorkspaceConflictError, parseBrowserWorkspaceRecord } from '@/features/project/persistence/workspaceRevision';
import * as structured from '@/features/project/persistence/structuredBrowserStorage';

const payload = (name: string) => JSON.stringify({ state: { name }, version: 4 });
let sequence = 0;
let namespace: string;
describe('workspace recovery failure safety', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    const scope = `account:recovery-safety-${++sequence}` as const;
    setProjectPersistenceScope(scope);
    namespace = `project-workspace:${scope}`;
  });
  afterEach(() => vi.restoreAllMocks());

  it('restores as a new revision and rejects a stale pre-restore writer', async () => {
    const storage = createScopedProjectStorage('project-workspace', { keepRecoverySnapshot: true });
    await storage.getItem('workspace');
    await storage.setItem('workspace', payload('first'));
    await storage.setItem('workspace', payload('second'));
    await expect(restoreBrowserWorkspaceRecovery('previous')).resolves.toBe(true);
    const raw = createBrowserKeyValueStorage(namespace);
    const restored = parseBrowserWorkspaceRecord((await raw.getItem('workspace'))!);
    expect(restored).toMatchObject({ revision: 3, value: payload('first') });
    expect(parseBrowserWorkspaceRecord((await raw.getItem('__recovery__:workspace'))!).value).toBe(payload('second'));
    await expect(compareAndSetBrowserWorkspaceValue({ namespace, key: 'workspace', value: payload('stale'), expectedRevision: 1, writerId: 'stale' })).rejects.toBeInstanceOf(BrowserWorkspaceConflictError);
    await expect(storage.getItem('workspace')).resolves.toBe(payload('first'));
    await expect(storage.setItem('workspace', payload('queued-old-state'))).rejects.toThrow('Reload before');
  });

  it('leaves current and recovery intact when another tab commits before restore', async () => {
    const storage = createScopedProjectStorage('project-workspace', { keepRecoverySnapshot: true });
    await storage.getItem('workspace');
    await storage.setItem('workspace', payload('first'));
    await storage.setItem('workspace', payload('second'));
    await compareAndSetBrowserWorkspaceValue({ namespace, key: 'workspace', value: payload('other-tab'), expectedRevision: 2, writerId: 'other' });
    await expect(restoreBrowserWorkspaceRecovery('previous')).rejects.toBeInstanceOf(BrowserWorkspaceConflictError);
    const raw = createBrowserKeyValueStorage(namespace);
    expect(parseBrowserWorkspaceRecord((await raw.getItem('workspace'))!).value).toBe(payload('other-tab'));
    expect(parseBrowserWorkspaceRecord((await raw.getItem('__recovery__:workspace'))!).value).toBe(payload('first'));
  });

  it('rejects queued recovery after switching accounts', async () => {
    const storage = createScopedProjectStorage('project-workspace', { keepRecoverySnapshot: true });
    await storage.getItem('workspace');
    await storage.setItem('workspace', payload('first'));
    await storage.setItem('workspace', payload('second'));
    const restoring = restoreBrowserWorkspaceRecovery('previous');
    setProjectPersistenceScope('account:another-recovery-owner');
    await expect(restoring).rejects.toThrow('account changed');
    const raw = createBrowserKeyValueStorage(namespace);
    expect(parseBrowserWorkspaceRecord((await raw.getItem('workspace'))!).value).toBe(payload('second'));
  });

  it('does not quarantine valid JSON when legacy artwork storage is unavailable', async () => {
    const raw = createBrowserKeyValueStorage(namespace);
    const legacy = JSON.stringify({ state: { artwork: 'data:image/png;base64,AAEC' }, version: 4 });
    await raw.setItem('workspace', legacy);
    vi.spyOn(structured, 'writeStructuredBrowserValues').mockRejectedValue(new Error('Artwork unavailable'));
    await expect(createScopedProjectStorage('project-workspace', { suppressWriteErrors: true }).getItem('workspace')).rejects.toThrow('Artwork unavailable');
    await expect(raw.getItem('workspace')).resolves.toBe(legacy);
    await expect(raw.getItem('__quarantine__:workspace')).resolves.toBeNull();
  });

  it('preserves original bytes when the quarantine transaction fails', async () => {
    const raw = createBrowserKeyValueStorage(namespace);
    await raw.setItem('workspace', '{broken');
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (String(key).includes('__quarantine__')) throw new DOMException('Quota reached', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(createScopedProjectStorage('project-workspace', { suppressWriteErrors: true }).getItem('workspace')).rejects.toThrow('Quota reached');
    await expect(raw.getItem('workspace')).resolves.toBe('{broken');
    await expect(raw.getItem('__quarantine__:workspace')).resolves.toBeNull();
  });

  it('rolls back the whole artwork batch when one blob cannot be stored', async () => {
    const raw = createBrowserKeyValueStorage(namespace);
    const legacy = JSON.stringify({ state: { art: ['data:image/png;base64,AAEC', 'data:image/png;base64,AwQF'] }, version: 4 });
    await raw.setItem('workspace', legacy);
    const put = IDBObjectStore.prototype.put;
    const keys: string[] = [];
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (String(key).startsWith('project-content-asset:')) {
        keys.push(String(key));
        if (keys.length === 2) throw new DOMException('Artwork disk full', 'QuotaExceededError');
      }
      return put.call(this, value, key);
    });
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace')).rejects.toThrow('Artwork disk full');
    expect(keys).toHaveLength(2);
    expect(await structured.readStructuredBrowserValue(keys[0]!)).toBeNull();
    expect(await raw.getItem('workspace')).toBe(legacy);
    expect(await raw.getItem('__quarantine__:workspace')).toBeNull();
  });

  it('rejects unreadable writes before displacing the previous saved work', async () => {
    const storage = createScopedProjectStorage('project-workspace');
    await storage.getItem('workspace');
    await storage.setItem('workspace', payload('safe'));
    await expect(storage.setItem('workspace', '{broken')).rejects.toThrow('readable JSON');
    await expect(storage.setItem('workspace', '{}')).rejects.toThrow('readable JSON');
    expect(getBrowserWorkspaceSaveStatus()).toBe('failed');
    await expect(storage.getItem('workspace')).resolves.toBe(payload('safe'));
  });

  it('fails account hydration and disables autosave until a readable retry succeeds', async () => {
    const { hydrateProjectWorkspaceForScope, useProjectStore } = await import('@/features/project/store/workspaceStore');
    const raw = createBrowserKeyValueStorage(namespace);
    await raw.setItem('workspace', '{broken');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(hydrateProjectWorkspaceForScope(`account:recovery-safety-${sequence}`)).rejects.toThrow('unreadable');
    useProjectStore.setState({ exportDpi: 150 });
    await expect(raw.getItem('workspace')).resolves.toBe('{broken');
    const options = useProjectStore.persist.getOptions();
    const initial = useProjectStore.getInitialState();
    await raw.setItem('workspace', JSON.stringify({ state: options.partialize!(initial), version: options.version }));
    await expect(hydrateProjectWorkspaceForScope(`account:recovery-safety-${sequence}`)).resolves.toBeUndefined();
    expect(useProjectStore.persist.hasHydrated()).toBe(true);
    log.mockRestore();
  });

  it('can return to a previously hydrated account after another account fails', async () => {
    const { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } = await import('@/features/project/store/workspaceStore');
    const scopeA = `account:recovery-safety-${sequence}` as const;
    await hydrateProjectWorkspaceForScope(scopeA);
    await new Promise((resolve) => setTimeout(resolve, 1));
    useProjectStore.getState().setExportDpi(150);
    await persistProjectWorkspaceNow();
    const scopeB = `account:failed-switch-${sequence}` as const;
    await createBrowserKeyValueStorage(`project-workspace:${scopeB}`).setItem('workspace', '{broken');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(hydrateProjectWorkspaceForScope(scopeB)).rejects.toThrow('unreadable');
    await hydrateProjectWorkspaceForScope(scopeA);
    expect(useProjectStore.getState().exportDpi).toBe(150);
    expect(useProjectStore.persist.hasHydrated()).toBe(true);
  });

  it('does not carry an unhydrated account state into a new empty account', async () => {
    const { hydrateProjectWorkspaceForScope, useProjectStore } = await import('@/features/project/store/workspaceStore');
    const failing = `account:failed-empty-switch-${sequence}` as const;
    await createBrowserKeyValueStorage(`project-workspace:${failing}`).setItem('workspace', '{broken');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(hydrateProjectWorkspaceForScope(failing)).rejects.toThrow('unreadable');
    useProjectStore.setState({ storedCards: [{ uniqueId: 'private-unhydrated-card', templateId: 'private', data: {} }] });
    await hydrateProjectWorkspaceForScope(`account:new-empty-${sequence}`);
    expect(useProjectStore.getState().storedCards).toHaveLength(0);
  });
});
