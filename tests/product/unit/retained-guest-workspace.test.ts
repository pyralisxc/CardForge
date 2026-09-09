import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { BROWSER_STORAGE_DATABASE, createIndexedDbStorage } from '@/features/project/client/persistence-storage';
import {
  consumeRetainedGuestWorkspaceForAccount,
  readRetainedGuestWorkspaceForAccount,
} from '@/features/project/persistence/guestWorkspaceAdoption';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

const workspace = (marker: string, setId?: string) => JSON.stringify({
  state: {
    marker,
    cardSets: setId ? [{ id: setId, name: marker }] : [],
    storedCards: [],
    userTemplates: [],
  },
  version: 4,
});

describe('retained signed-out workspace handoff', () => {
  beforeEach(deleteDatabase);

  it('reports signed-out authored work only beside an already-existing account workspace', async () => {
    const account = createIndexedDbStorage('project-workspace:account:returning');
    const guest = createIndexedDbStorage('project-workspace:guest');
    await guest.setItem('workspace', workspace('Guest Set', 'guest-set'));

    await expect(readRetainedGuestWorkspaceForAccount('account:returning')).resolves.toBeNull();
    await account.setItem('workspace', workspace('Account Set', 'account-set'));
    await expect(readRetainedGuestWorkspaceForAccount('account:returning')).resolves.toMatchObject({
      accountScope: 'account:returning', setCount: 1, cardCount: 0, templateCount: 0,
    });
  });

  it('consumes only the exact signed-out snapshot after an explicit successful import', async () => {
    const account = createIndexedDbStorage('project-workspace:account:returning');
    const guest = createIndexedDbStorage('project-workspace:guest');
    await account.setItem('workspace', workspace('Account Set', 'account-set'));
    await guest.setItem('workspace', workspace('Guest Set', 'guest-set'));
    const retained = await readRetainedGuestWorkspaceForAccount('account:returning');
    expect(retained).not.toBeNull();

    await expect(consumeRetainedGuestWorkspaceForAccount(retained!)).resolves.toBe(true);
    await expect(guest.getItem('workspace')).resolves.toBeNull();
    await expect(account.getItem('workspace')).resolves.toContain('Account Set');
  });

  it('leaves newer signed-out work intact instead of consuming a stale reviewed snapshot', async () => {
    const account = createIndexedDbStorage('project-workspace:account:returning');
    const guest = createIndexedDbStorage('project-workspace:guest');
    await account.setItem('workspace', workspace('Account Set', 'account-set'));
    await guest.setItem('workspace', workspace('Guest Set', 'guest-set'));
    const retained = await readRetainedGuestWorkspaceForAccount('account:returning');
    expect(retained).not.toBeNull();

    await guest.setItem('workspace', workspace('Newer Guest Set', 'guest-set-newer'));
    await expect(consumeRetainedGuestWorkspaceForAccount(retained!)).resolves.toBe(false);
    await expect(guest.getItem('workspace')).resolves.toContain('Newer Guest Set');
    await expect(account.getItem('workspace')).resolves.toContain('Account Set');
  });
});
