import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  BROWSER_STORAGE_DATABASE,
  createBrowserKeyValueStorage,
  createIndexedDbStorage,
  createProjectPersistenceScope,
  createScopedProjectStorage,
  getScopedProjectStorageNamespace,
  setProjectPersistenceScope,
} from '@/features/project/client';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

describe('Studio project persistence scope', () => {
  beforeEach(async () => {
    await deleteDatabase();
    setProjectPersistenceScope('local');
  });

  it('derives stable account, guest, and local scopes without exposing raw separators', () => {
    expect(createProjectPersistenceScope({ authConfigured: false, accountUserId: 'ignored' })).toBe('local');
    expect(createProjectPersistenceScope({ authConfigured: true, accountUserId: null })).toBe('guest');
    expect(createProjectPersistenceScope({ authConfigured: true, accountUserId: 'user:abc/123' }))
      .toBe('account:user%3Aabc%2F123');
  });

  it('keeps two signed-in accounts isolated in the same browser database', async () => {
    const storage = createScopedProjectStorage('project-workspace');

    setProjectPersistenceScope('account:user-a');
    await storage.setItem('workspace', '{"owner":"a"}');

    setProjectPersistenceScope('account:user-b');
    expect(await storage.getItem('workspace')).toBeNull();
    await storage.setItem('workspace', '{"owner":"b"}');

    setProjectPersistenceScope('account:user-a');
    expect(await storage.getItem('workspace')).toBe('{"owner":"a"}');

    setProjectPersistenceScope('account:user-b');
    expect(await storage.getItem('workspace')).toBe('{"owner":"b"}');
  });

  it('does not assign legacy unscoped Studio state to the first account that opens Studio', async () => {
    const legacy = createIndexedDbStorage('project-workspace');
    await legacy.setItem('workspace', '{"legacy":true}');

    setProjectPersistenceScope('account:user-a');
    const scoped = createScopedProjectStorage('project-workspace');

    expect(await scoped.getItem('workspace')).toBeNull();
    expect(await legacy.getItem('workspace')).toBe('{"legacy":true}');
    expect(getScopedProjectStorageNamespace('project-workspace')).toBe('project-workspace:account:user-a');
  });

  it('quarantines corrupt workspace JSON and boots from an empty scoped workspace', async () => {
    setProjectPersistenceScope('account:user-a');
    const namespace = getScopedProjectStorageNamespace('project-workspace');
    const raw = createBrowserKeyValueStorage(namespace);
    await raw.setItem('workspace', '{not-json');

    const scoped = createScopedProjectStorage('project-workspace');
    expect(await scoped.getItem('workspace')).toBeNull();
    expect(await raw.getItem('workspace')).toBeNull();
    expect(await raw.getItem('__quarantine__:workspace')).toBe('{not-json');
  });

  it('quarantines pathological workspace payloads before Zustand parses them', async () => {
    setProjectPersistenceScope('account:user-a');
    const namespace = getScopedProjectStorageNamespace('project-workspace');
    const raw = createBrowserKeyValueStorage(namespace);
    const oversized = JSON.stringify({ data: 'x'.repeat(8 * 1024 * 1024) });
    await raw.setItem('workspace', oversized);

    const scoped = createScopedProjectStorage('project-workspace');
    expect(await scoped.getItem('workspace')).toBeNull();
    expect(await raw.getItem('workspace')).toBeNull();
    expect(await raw.getItem('__quarantine__:workspace')).toBe(oversized);
  });
});
