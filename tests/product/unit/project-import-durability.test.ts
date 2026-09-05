import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyProjectDocumentToWorkspace, captureCurrentProjectDocument } from '@/features/project/client/projectWorkspaceDocument';
import { useProjectStore } from '@/features/project/store/workspaceStore';
import { createIndexedDbStorage } from '@/features/project/persistence/indexedDbStorage';
import { setProjectPersistenceScope } from '@/features/project/persistence/projectPersistenceScope';
import { getProjectAssetStorage, mergeProjectAssetListToStorage } from '@/features/project/persistence/projectAssets';
import { parseBrowserWorkspaceRecord } from '@/features/project/persistence/workspaceRevision';

describe('project import durability', () => {
  beforeEach(() => {
    setProjectPersistenceScope('guest');
    useProjectStore.setState({ cardSets: [], activeCardSet: null, storedCards: [], userTemplates: [], appearanceStyles: [] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps unrelated Sets and remaps a colliding imported Set before committing the complete workspace', async () => {
    const originalSet = { id: 'existing', name: 'Local work' };
    useProjectStore.setState({ cardSets: [originalSet], activeCardSet: originalSet });
    const document = await captureCurrentProjectDocument();
    document.cardSets = [{ id: 'existing', name: 'Provider work' }];
    const imported = await applyProjectDocumentToWorkspace(document, 'copy');
    expect(imported.activeSetId).not.toBe('existing');
    expect(useProjectStore.getState().cardSets).toEqual(expect.arrayContaining([
      originalSet, expect.objectContaining({ id: imported.activeSetId, name: 'Provider work' }),
    ]));
    const raw = await createIndexedDbStorage('project-workspace:guest').getItem('workspace');
    const persisted = JSON.parse(parseBrowserWorkspaceRecord(raw!).value);
    expect(persisted.state.cardSets).toEqual(useProjectStore.getState().cardSets);
  });

  it('rejects the import if the final workspace transaction aborts after its write request succeeds', async () => {
    const document = await captureCurrentProjectDocument();
    document.cardSets = [{ id: 'incoming', name: 'Incoming' }];
    document.activeCardSetId = 'incoming';
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = originalPut.call(this, value, key);
      if (key === 'project-workspace:guest:workspace') {
        request.addEventListener('success', () => this.transaction.abort());
      }
      return request;
    });
    await expect(applyProjectDocumentToWorkspace(document, 'merge')).rejects.toThrow();
  });

  it('preserves a corrupt asset list instead of converting it to an empty merge target', async () => {
    const raw = createIndexedDbStorage('project-assets:guest');
    await raw.setItem('corrupt-images', '{broken');
    await expect(mergeProjectAssetListToStorage(getProjectAssetStorage(), 'corrupt-images', [{ id: 'new' }])).rejects.toThrow();
    expect(await raw.getItem('corrupt-images')).toBe('{broken');
    await raw.removeItem('corrupt-images');
  });

  it('rejects an asset write whose transaction aborts after the request succeeds', async () => {
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = originalPut.call(this, value, key);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(createIndexedDbStorage('project-assets:guest').setItem('images', '[]')).rejects.toThrow();
  });
});
