import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as browserAssets from '@/features/project/persistence/contentAddressedBrowserAssets';
import { compareAndSetBrowserWorkspaceValue } from '@/features/project/persistence/indexedDbStorage';

import { adoptGuestWorkspaceForAccount, createProjectPersistenceScope, createScopedProjectStorage, getScopedProjectStorageNamespace, setProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { BROWSER_STORAGE_DATABASE, createIndexedDbStorage } from '@/features/project/client/persistence-storage';
import { getProjectAssetStorage, readTypedProjectAssetListFromStorage, writeProjectAssetListToStorage } from '@/features/project/client/assets';
import { CUSTOM_IMAGE_ASSETS_STORAGE_KEY } from '@/features/project/model/projectDocument';
import { prepareAccountProjectWorkspace } from '@/features/project/client/accountProjectWorkspace';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

describe('Studio account-scoped persistence', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(async () => {
    await deleteDatabase();
    setProjectPersistenceScope('local');
  });

  it('derives stable account, guest, and local scopes', () => {
    expect(createProjectPersistenceScope({ authConfigured: false, accountUserId: 'ignored' })).toBe('local');
    expect(createProjectPersistenceScope({ authConfigured: true, accountUserId: null })).toBe('guest');
    expect(createProjectPersistenceScope({ authConfigured: true, accountUserId: 'user:abc/123' }))
      .toBe('account:user%3Aabc%2F123');
  });

  it('isolates workspace state between authenticated account scopes', async () => {
    setProjectPersistenceScope('account:user-a');
    const accountA = createScopedProjectStorage('project-workspace');
    await accountA.setItem('workspace', JSON.stringify({ state: { marker: 'a' }, version: 1 }));

    setProjectPersistenceScope('account:user-b');
    const accountB = createScopedProjectStorage('project-workspace');
    await expect(accountB.getItem('workspace')).resolves.toBeNull();
    await accountB.setItem('workspace', JSON.stringify({ state: { marker: 'b' }, version: 1 }));

    setProjectPersistenceScope('account:user-a');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace'))
      .resolves.toContain('"marker":"a"');

    setProjectPersistenceScope('account:user-b');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace'))
      .resolves.toContain('"marker":"b"');
  });

  it('serializes rapid same-tab workspace saves through the revision boundary', async () => {
    setProjectPersistenceScope('account:same-tab-writes');
    const workspace = createScopedProjectStorage('project-workspace');
    await expect(workspace.getItem('workspace')).resolves.toBeNull();

    await expect(Promise.all([
      workspace.setItem('workspace', JSON.stringify({ state: { marker: 'first' }, version: 3 })),
      workspace.setItem('workspace', JSON.stringify({ state: { marker: 'second' }, version: 3 })),
      workspace.setItem('workspace', JSON.stringify({ state: { marker: 'final' }, version: 3 })),
    ])).resolves.toEqual([undefined, undefined, undefined]);

    await expect(workspace.getItem('workspace')).resolves.toContain('"marker":"final"');
  });

  it('persists repeated browser artwork once by content hash and keeps workspace hydration lazy', async () => {
    const artwork = 'data:image/png;base64,AAECAwQ=';
    setProjectPersistenceScope('account:user-assets');
    const workspace = createScopedProjectStorage('project-workspace');

    await workspace.setItem('workspace', JSON.stringify({
      state: {
        userTemplates: [{ id: 'template-1', imageSource: artwork }],
        storedCards: [{ uniqueId: 'card-1', data: { Artwork: artwork } }],
      },
      version: 1,
    }));

    const raw = createIndexedDbStorage(getScopedProjectStorageNamespace('project-workspace'));
    const stored = await raw.getItem('workspace');
    expect(stored).not.toContain('base64');
    expect(stored?.match(/cardforge-browser-asset:\/\//g)).toHaveLength(2);
    expect(new Set(stored?.match(/cardforge-browser-asset:\/\/[a-f0-9]{64}/g))).toHaveLength(1);

    const hydrated = await workspace.getItem('workspace');
    expect(hydrated).not.toContain('base64');
    expect(hydrated?.match(/cardforge-browser-asset:\/\//g)).toHaveLength(2);
  });

  it('uses the same content-addressed persistence for the local asset catalog', async () => {
    const artwork = 'data:image/webp;base64,V0VCUA==';
    setProjectPersistenceScope('account:user-library-assets');
    const storage = getProjectAssetStorage();

    await writeProjectAssetListToStorage(storage, 'images', [{
      id: 'asset-1',
      name: 'Artwork',
      kind: 'image',
      url: artwork,
    }]);

    const raw = createIndexedDbStorage(getScopedProjectStorageNamespace('project-assets'));
    expect(await raw.getItem('images')).toMatch(/cardforge-browser-asset:\/\/[a-f0-9]{64}/);
    await expect(readTypedProjectAssetListFromStorage<{ url: string }>(storage, 'images'))
      .resolves.toEqual([expect.objectContaining({ url: expect.stringMatching(/^cardforge-browser-asset:\/\/[a-f0-9]{64}$/u) })]);
  });

  it('never hydrates the legacy browser-global workspace into an account', async () => {
    const legacy = createIndexedDbStorage('project-workspace');
    await legacy.setItem(
      'workspace',
      JSON.stringify({ state: { marker: 'legacy-plugin-state' }, version: 1 }),
    );

    setProjectPersistenceScope('account:user-c');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace')).resolves.toBeNull();
    await expect(legacy.getItem('workspace')).resolves.toContain('legacy-plugin-state');
  });

  it('adopts current guest work before hydrating the newly signed account without returning a choice', async () => {
    const calls: string[] = [];

    await expect(prepareAccountProjectWorkspace('account:continuity', {
      adopt: async (scope) => {
        calls.push(`adopt:${scope}`);
        return true;
      },
      hydrate: async (scope) => {
        calls.push(`hydrate:${scope}`);
      },
    })).resolves.toBeUndefined();

    expect(calls).toEqual(['adopt:account:continuity', 'hydrate:account:continuity']);
  });

  it('resumes existing account work without replacing it or transferring guest catalogs', async () => {
    const guestWorkspace = createIndexedDbStorage('project-workspace:guest');
    const accountWorkspace = createIndexedDbStorage('project-workspace:account:user-adoption');
    const guestAssets = createIndexedDbStorage('project-assets:guest');
    const accountAssets = createIndexedDbStorage('project-assets:account:user-adoption');
    await guestWorkspace.setItem('workspace', JSON.stringify({ state: { marker: 'guest-current-work' }, version: 3 }));
    await accountWorkspace.setItem('workspace', JSON.stringify({ state: { marker: 'account-recovery-work' }, version: 3 }));
    await guestAssets.setItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY, JSON.stringify([{ id: 'guest-art', name: 'Guest art' }]));
    await accountAssets.setItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY, JSON.stringify([{ id: 'account-art', name: 'Account art' }]));

    await expect(adoptGuestWorkspaceForAccount('account:user-adoption')).resolves.toBe(false);

    await expect(accountWorkspace.getItem('workspace')).resolves.toContain('account-recovery-work');
    await expect(accountWorkspace.getItem('__recovery__:workspace')).resolves.toBeNull();
    await expect(accountAssets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).resolves.not.toContain('guest-art');
    await expect(accountAssets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).resolves.toContain('account-art');
    await expect(guestWorkspace.getItem('workspace')).resolves.toContain('guest-current-work');
    await expect(guestAssets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).resolves.toContain('guest-art');
  });

  it('never carries a completed guest handoff into another account scope', async () => {
    const guestWorkspace = createIndexedDbStorage('project-workspace:guest');
    const guestAssets = createIndexedDbStorage('project-assets:guest');
    await guestWorkspace.setItem('workspace', JSON.stringify({ state: { marker: 'guest-current-work' }, version: 3 }));
    await guestAssets.setItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY, JSON.stringify([{ id: 'guest-art' }]));

    await expect(adoptGuestWorkspaceForAccount('account:first')).resolves.toBe(true);
    await expect(adoptGuestWorkspaceForAccount('account:second')).resolves.toBe(false);
    await expect(createIndexedDbStorage('project-workspace:account:second').getItem('workspace')).resolves.toBeNull();
    await expect(createIndexedDbStorage('project-assets:account:first').getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).resolves.toContain('guest-art');
    await expect(guestAssets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).resolves.toBeNull();
  });

  it('leaves an unreadable existing account workspace untouched for recovery', async () => {
    const guest = createIndexedDbStorage('project-workspace:guest');
    const account = createIndexedDbStorage('project-workspace:account:unreadable');
    await guest.setItem('workspace', JSON.stringify({ state: { marker: 'guest-work' }, version: 4 }));
    await account.setItem('workspace', '{original unreadable authored bytes');
    await expect(adoptGuestWorkspaceForAccount('account:unreadable')).resolves.toBe(false);
    await expect(account.getItem('workspace')).resolves.toBe('{original unreadable authored bytes');
    await expect(guest.getItem('workspace')).resolves.toContain('guest-work');
  });

  it.each(['revisioned', 'unreadable'])('rejects guest adoption if another tab creates %s account work during preparation', async (format) => {
    const guest = createIndexedDbStorage('project-workspace:guest');
    const namespace = 'project-workspace:account:concurrent';
    await guest.setItem('workspace', JSON.stringify({ state: { marker: 'guest-work' }, version: 4 }));
    vi.spyOn(browserAssets, 'copyBrowserProjectAssets').mockImplementationOnce(async () => {
      if (format === 'revisioned') await compareAndSetBrowserWorkspaceValue({ namespace, key: 'workspace', value: JSON.stringify({ state: { marker: 'new-owner-work' }, version: 4 }), expectedRevision: 0, writerId: 'other-tab' });
      else await createIndexedDbStorage(namespace).setItem('workspace', '{new-owner-work original corrupt bytes');
      return 0;
    });
    await expect(adoptGuestWorkspaceForAccount('account:concurrent')).rejects.toThrow('workspace was created');
    await expect(createIndexedDbStorage(namespace).getItem('workspace')).resolves.toContain('new-owner-work');
    await expect(guest.getItem('workspace')).resolves.toContain('guest-work');
  });

  it('rolls back account publication and guest consumption when a catalog write fails', async () => {
    const guest = createIndexedDbStorage('project-workspace:guest');
    const guestAssets = createIndexedDbStorage('project-assets:guest');
    const account = createIndexedDbStorage('project-workspace:account:quota');
    await guest.setItem('workspace', JSON.stringify({ state: { marker: 'guest-work' }, version: 4 }));
    await guestAssets.setItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY, JSON.stringify([{ id: 'guest-art' }]));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (String(key).startsWith('project-assets:account:quota:')) throw new DOMException('No space', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(adoptGuestWorkspaceForAccount('account:quota')).rejects.toThrow('No space');
    await expect(account.getItem('workspace')).resolves.toBeNull();
    await expect(guest.getItem('workspace')).resolves.toContain('guest-work');
    await expect(guestAssets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).resolves.toContain('guest-art');
  });

  it('does not consume guest work edited while its first account handoff was preparing', async () => {
    const guest = createIndexedDbStorage('project-workspace:guest');
    await guest.setItem('workspace', JSON.stringify({ state: { marker: 'guest-before' }, version: 4 }));
    vi.spyOn(browserAssets, 'copyBrowserProjectAssets').mockImplementationOnce(async () => {
      await guest.setItem('workspace', JSON.stringify({ state: { marker: 'guest-newer' }, version: 4 }));
      return 0;
    });
    await expect(adoptGuestWorkspaceForAccount('account:guest-race')).rejects.toThrow('changed');
    await expect(guest.getItem('workspace')).resolves.toContain('guest-newer');
    await expect(createIndexedDbStorage('project-workspace:account:guest-race').getItem('workspace')).resolves.toBeNull();
  });

  it('quarantines corrupt scoped workspace JSON instead of returning it to Zustand', async () => {
    setProjectPersistenceScope('account:user-corrupt');
    const namespace = getScopedProjectStorageNamespace('project-workspace');
    const rawStorage = createIndexedDbStorage(namespace);
    await rawStorage.setItem('workspace', '{ definitely-not-json');

    const scopedStorage = createScopedProjectStorage('project-workspace');
    await expect(scopedStorage.getItem('workspace')).rejects.toThrow('unreadable');
    await expect(rawStorage.getItem('workspace')).resolves.toBe('{ definitely-not-json');
    await expect(rawStorage.getItem('__quarantine__:workspace')).resolves.toBe('{ definitely-not-json');
  });

  it('round-trips valid workspace JSON beyond the former read-only ceiling', async () => {
    setProjectPersistenceScope('account:user-large');
    const namespace = getScopedProjectStorageNamespace('project-workspace');
    const rawStorage = createIndexedDbStorage(namespace);
    const oversized = JSON.stringify({ state: { data: 'x'.repeat(8 * 1024 * 1024) }, version: 4 });
    await createScopedProjectStorage('project-workspace').setItem('workspace', oversized);

    const scopedStorage = createScopedProjectStorage('project-workspace');
    expect((await scopedStorage.getItem('workspace')) === oversized).toBe(true);
    await expect(rawStorage.getItem('__quarantine__:workspace')).resolves.toBeNull();
  });
});
