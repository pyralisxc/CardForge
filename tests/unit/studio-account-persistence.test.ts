import 'fake-indexeddb/auto';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyGuestWorkspaceAdoption,
  BROWSER_STORAGE_DATABASE,
  createIndexedDbStorage,
  createProjectPersistenceScope,
  createScopedProjectStorage,
  getProjectAssetStorage,
  getScopedProjectStorageNamespace,
  inspectGuestWorkspaceAdoption,
  readTypedProjectAssetListFromStorage,
  setProjectPersistenceScope,
  writeProjectAssetListToStorage,
} from '@/features/project/client';

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

describe('Studio account-scoped persistence', () => {
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
      .resolves.toEqual([expect.objectContaining({ url: artwork })]);
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

  it('offers guest work after sign-in and adopts it only after the explicit replace choice', async () => {
    setProjectPersistenceScope('guest');
    await createScopedProjectStorage('project-workspace').setItem(
      'workspace',
      JSON.stringify({ state: { marker: 'guest-work' }, version: 3 }),
    );

    const offer = await inspectGuestWorkspaceAdoption('account:user-adoption');
    expect(offer).toEqual({ guestRevision: 1, hasAccountWorkspace: false });

    await applyGuestWorkspaceAdoption({
      accountScope: 'account:user-adoption',
      choice: 'replace-with-guest-workspace',
    });
    setProjectPersistenceScope('account:user-adoption');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace'))
      .resolves.toContain('guest-work');
    setProjectPersistenceScope('guest');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace'))
      .resolves.toContain('guest-work');
    await expect(inspectGuestWorkspaceAdoption('account:user-adoption')).resolves.toBeNull();
  });

  it('keeps both guest and account work unchanged when the account workspace is chosen', async () => {
    setProjectPersistenceScope('guest');
    const guestWorkspace = createScopedProjectStorage('project-workspace');
    await guestWorkspace.getItem('workspace');
    await guestWorkspace.setItem(
      'workspace',
      JSON.stringify({ state: { marker: 'guest-kept' }, version: 3 }),
    );
    setProjectPersistenceScope('account:user-keep');
    const accountWorkspace = createScopedProjectStorage('project-workspace');
    await accountWorkspace.getItem('workspace');
    await accountWorkspace.setItem(
      'workspace',
      JSON.stringify({ state: { marker: 'account-kept' }, version: 3 }),
    );

    await applyGuestWorkspaceAdoption({
      accountScope: 'account:user-keep',
      choice: 'keep-account-workspace',
    });

    setProjectPersistenceScope('guest');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace'))
      .resolves.toContain('guest-kept');
    setProjectPersistenceScope('account:user-keep');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace'))
      .resolves.toContain('account-kept');
  });

  it('quarantines corrupt scoped workspace JSON instead of returning it to Zustand', async () => {
    setProjectPersistenceScope('account:user-corrupt');
    const namespace = getScopedProjectStorageNamespace('project-workspace');
    const rawStorage = createIndexedDbStorage(namespace);
    await rawStorage.setItem('workspace', '{ definitely-not-json');

    const scopedStorage = createScopedProjectStorage('project-workspace');
    await expect(scopedStorage.getItem('workspace')).resolves.toBeNull();
    await expect(rawStorage.getItem('workspace')).resolves.toBeNull();
    await expect(rawStorage.getItem('__quarantine__:workspace')).resolves.toBe('{ definitely-not-json');
  });

  it('quarantines pathological workspace payloads before Zustand parses them', async () => {
    setProjectPersistenceScope('account:user-large');
    const namespace = getScopedProjectStorageNamespace('project-workspace');
    const rawStorage = createIndexedDbStorage(namespace);
    const oversized = JSON.stringify({ data: 'x'.repeat(8 * 1024 * 1024) });
    await rawStorage.setItem('workspace', oversized);

    const scopedStorage = createScopedProjectStorage('project-workspace');
    await expect(scopedStorage.getItem('workspace')).resolves.toBeNull();
    await expect(rawStorage.getItem('workspace')).resolves.toBeNull();
    await expect(rawStorage.getItem('__quarantine__:workspace')).resolves.toBe(oversized);
  });

  it('hydrates the selected account before mounting the heavyweight Studio shell', async () => {
    const loader = await readFile(
      rootPath('src/features/app-shell/components/StudioRuntimeLoader.tsx'),
      'utf8',
    );
    const scopedShell = await readFile(
      rootPath('src/features/app-shell/components/ScopedCardForgeStudioShell.tsx'),
      'utf8',
    );
    const workspaceStore = await readFile(
      rootPath('src/features/project/store/workspaceStore.ts'),
      'utf8',
    );

    expect(loader).toContain("import('./ScopedCardForgeStudioShell')");
    expect(loader).toContain('persistenceScope={persistenceScope}');
    expect(scopedShell).toContain('hydrateProjectWorkspaceForScope(persistenceScope)');
    expect(scopedShell).toContain('<CardForgeStudioShell');
    expect(workspaceStore).toContain('skipHydration: true');
    expect(workspaceStore).toContain('useProjectStore.setState(useProjectStore.getInitialState())');
  });

  it('keeps non-agent external Studio documents as active-project opens instead of accumulating them', async () => {
    const handoff = await readFile(
      rootPath('src/features/studio-documents/hooks/useStudioDocumentHandoff.ts'),
      'utf8',
    );
    const branchStart = handoff.indexOf('// Non-agent Studio documents retain project-open semantics.');
    const branchEnd = handoff.indexOf('      } catch (error) {', branchStart);
    const nonAgentWorkspaceBranch = handoff.slice(branchStart, branchEnd);

    expect(branchStart).toBeGreaterThan(-1);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(handoff).toContain('writeProjectAssetListToStorage');
    expect(nonAgentWorkspaceBranch).toContain('useProjectStore.setState({');
    expect(nonAgentWorkspaceBranch).toContain('userTemplates: []');
    expect(nonAgentWorkspaceBranch).toContain('appearanceStyles: []');
    expect(nonAgentWorkspaceBranch).toContain('storedCards: []');
    expect(nonAgentWorkspaceBranch).toContain('mergeStoredCards(patch.storedCards)');
    expect(handoff).toContain('normalizeStudioDocumentPayload');
    expect(handoff).toContain('applyProjectDocumentToState');
  });
});
