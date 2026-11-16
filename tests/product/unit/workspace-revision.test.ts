import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBrowserWorkspaceSaveStatus } from '@/features/project/persistence/indexedDbStorage';

import { BROWSER_STORAGE_DATABASE, compareAndSetBrowserWorkspaceValue, createIndexedDbStorage } from '@/features/project/client/persistence-storage';
import { BrowserWorkspaceConflictError, createScopedProjectStorage, parseBrowserWorkspaceRecord, setProjectPersistenceScope } from '@/features/project/client/persistence-workspace';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

describe('browser workspace revisions', () => {
  beforeEach(deleteDatabase);

  it('reports database-open failures and clears saving status after recovery', async () => {
    const input = { namespace: 'save-status', key: 'workspace', value: '{}', expectedRevision: 0, writerId: 'test' };
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => { throw new Error('Unavailable'); });
    try {
      await expect(compareAndSetBrowserWorkspaceValue(input)).rejects.toThrow('Unavailable');
      expect(getBrowserWorkspaceSaveStatus()).toBe('failed');
      await compareAndSetBrowserWorkspaceValue(input);
      expect(getBrowserWorkspaceSaveStatus()).toBe('saved');
    } finally { open.mockRestore(); }
  });

  it('upgrades existing Zustand JSON from revision zero while retaining its recovery copy', async () => {
    const original = '{"state":{"name":"legacy"}}';
    expect(parseBrowserWorkspaceRecord(original)).toEqual({
      revision: 0,
      writerId: null,
      value: original,
      legacy: true,
    });
    const namespace = 'project-workspace:account:legacy-upgrade';
    const storage = createIndexedDbStorage(namespace);
    await storage.setItem('workspace', original);
    await expect(compareAndSetBrowserWorkspaceValue({
      namespace, key: 'workspace', value: original, expectedRevision: 0,
      writerId: 'current-client', keepRecoverySnapshot: true,
    })).resolves.toBe(1);
    expect(parseBrowserWorkspaceRecord((await storage.getItem('workspace'))!)).toMatchObject({ revision: 1, value: original, legacy: false });
    await expect(storage.getItem('__recovery__:workspace')).resolves.toBe(original);
  });

  it('refuses unsupported workspace framing before reading or committing over saved work and recovery assets', async () => {
    setProjectPersistenceScope('account:unsupported-record');
    const namespace = 'project-workspace:account:unsupported-record';
    const storage = createIndexedDbStorage(namespace);
    const original = JSON.stringify({ cardforgeWorkspaceRecord: 2, revision: 41, writerId: 'newer-client', value: '{"state":{"name":"newer work"},"version":7}' });
    const previous = '{"state":{"name":"previous work"},"version":4}';
    await storage.setItem('workspace', original);
    await storage.setItem('__recovery__:workspace', previous);
    await storage.setItem('artwork', 'original artwork');
    await storage.setItem('__recovery_assets__:workspace', 'previous artwork');
    const beforeCommit = vi.fn();

    await expect(compareAndSetBrowserWorkspaceValue({
      namespace, key: 'workspace', value: '{"state":{"name":"older client"},"version":6}',
      expectedRevision: 0, writerId: 'older-client', keepRecoverySnapshot: true,
      relatedWrites: [{ key: `${namespace}:artwork`, value: 'replacement artwork', expectedValue: 'original artwork' }],
      recoveryKeys: [`${namespace}:artwork`], beforeCommit,
    })).rejects.toThrow(/unsupported.*format/i);
    expect(beforeCommit).not.toHaveBeenCalled();
    expect(getBrowserWorkspaceSaveStatus()).toBe('failed');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace')).rejects.toThrow(/unsupported.*format/i);
    await expect(storage.getItem('workspace')).resolves.toBe(original);
    await expect(storage.getItem('__recovery__:workspace')).resolves.toBe(previous);
    await expect(storage.getItem('artwork')).resolves.toBe('original artwork');
    await expect(storage.getItem('__recovery_assets__:workspace')).resolves.toBe('previous artwork');
    await expect(storage.getItem('__quarantine__:workspace')).resolves.toBeNull();
  });

  it('atomically refuses a stale writer instead of overwriting another tab', async () => {
    const namespace = 'project-workspace:account:conflict-test';
    await expect(compareAndSetBrowserWorkspaceValue({
      namespace,
      key: 'workspace',
      value: '{"state":{"tab":"first"}}',
      expectedRevision: 0,
      writerId: 'tab-a',
    })).resolves.toBe(1);

    await expect(compareAndSetBrowserWorkspaceValue({
      namespace,
      key: 'workspace',
      value: '{"state":{"tab":"stale"}}',
      expectedRevision: 0,
      writerId: 'tab-b',
    })).rejects.toEqual(expect.objectContaining({
      name: BrowserWorkspaceConflictError.name,
      expectedRevision: 0,
      actualRevision: 1,
    }));

    const raw = await createIndexedDbStorage(namespace).getItem('workspace');
    expect(parseBrowserWorkspaceRecord(raw!).value).toContain('first');
  });

});
