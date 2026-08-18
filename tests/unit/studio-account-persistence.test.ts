import 'fake-indexeddb/auto';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createIndexedDbStorage,
  createScopedProjectStorage,
  getScopedProjectStorageNamespace,
  setProjectPersistenceScope,
} from '@/features/project/client';

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

describe('Studio account-scoped persistence', () => {
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

  it('never hydrates the legacy browser-global workspace into an account', async () => {
    await createIndexedDbStorage('project-workspace').setItem(
      'workspace',
      JSON.stringify({ state: { marker: 'legacy-plugin-state' }, version: 1 }),
    );

    setProjectPersistenceScope('account:user-c');
    await expect(createScopedProjectStorage('project-workspace').getItem('workspace')).resolves.toBeNull();
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

  it('opens an external Studio document as the active project instead of accumulating it', async () => {
    const handoff = await readFile(
      rootPath('src/features/studio-documents/hooks/useStudioDocumentHandoff.ts'),
      'utf8',
    );

    expect(handoff).toContain('writeProjectAssetListToStorage');
    expect(handoff).not.toContain('mergeProjectAssetListToStorage');
    expect(handoff).toContain('useProjectStore.setState({');
    expect(handoff).toContain('userTemplates: []');
    expect(handoff).toContain('appearanceStyles: []');
    expect(handoff).toContain('storedCards: []');
    expect(handoff).toContain('normalizeStudioDocumentPayload');
    expect(handoff).toContain('applyProjectDocumentToState');
  });
});
