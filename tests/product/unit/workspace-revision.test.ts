import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  BROWSER_STORAGE_DATABASE,
  BrowserWorkspaceConflictError,
  compareAndSetBrowserWorkspaceValue,
  createIndexedDbStorage,
  parseBrowserWorkspaceRecord,
  resolveGuestWorkspaceAdoption,
} from '@/features/project/client';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

describe('browser workspace revisions', () => {
  beforeEach(deleteDatabase);

  it('treats existing Zustand JSON as a revision-zero legacy record', () => {
    expect(parseBrowserWorkspaceRecord('{"state":{"name":"legacy"}}')).toEqual({
      revision: 0,
      writerId: null,
      value: '{"state":{"name":"legacy"}}',
      legacy: true,
    });
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

  it('requires an explicit adoption choice', () => {
    expect(resolveGuestWorkspaceAdoption({
      choice: 'keep-account-workspace',
      guestValue: 'guest',
      accountValue: 'account',
    })).toBe('account');
    expect(resolveGuestWorkspaceAdoption({
      choice: 'replace-with-guest-workspace',
      guestValue: 'guest',
      accountValue: 'account',
    })).toBe('guest');
  });
});
