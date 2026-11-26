import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyProjectDocumentToWorkspace,
  captureCurrentProjectDocument,
  hasProjectDocumentStateChanged,
} from '@/features/project/client/projectWorkspaceDocument';
import { useProjectStore } from '@/features/project/store/workspaceStore';
import { createIndexedDbStorage } from '@/features/project/persistence/indexedDbStorage';
import { setProjectPersistenceScope } from '@/features/project/persistence/projectPersistenceScope';
import { getProjectAssetStorage, mergeProjectAssetListToStorage } from '@/features/project/persistence/projectAssets';
import { parseBrowserWorkspaceRecord } from '@/features/project/persistence/workspaceRevision';
import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { selectGeneratedDisplayCards } from '@/features/project/store/selectors';

describe('project import durability', () => {
  beforeEach(() => {
    setProjectPersistenceScope('guest');
    useProjectStore.setState({ cardSets: [], activeCardSet: null, storedCards: [], userTemplates: [], appearanceStyles: [] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not signal a project change when activating the already-active Set', () => {
    const active = { id: 'set-a', name: 'A' };
    useProjectStore.setState({ cardSets: [active], activeCardSet: active });
    const before = useProjectStore.getState();
    const listener = vi.fn();
    const unsubscribe = useProjectStore.subscribe(listener);
    before.setActiveCardSetId(active.id);
    expect(useProjectStore.getState()).toBe(before);
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not signal a project change for an equivalent active Set object', () => {
    const active = { id: 'set-a', name: 'A' };
    useProjectStore.setState({ cardSets: [active], activeCardSet: structuredClone(active) });
    const before = useProjectStore.getState();
    before.setActiveCardSetId(active.id);
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(false);
  });

  it('does not signal edits for an unchanged Studio library bootstrap, while retaining real library changes', () => {
    const template = reconstructMinimalTemplateObject({ id: 'default-a', name: 'Default', templateSource: 'default' });
    const personal = reconstructMinimalTemplateObject({ id: 'personal-a', name: 'Personal', templateSource: 'user' });
    const style = { id: 'style-a', name: 'Style', kind: 'material' as const, targets: [], appearance: {} };
    useProjectStore.getState().setDefaultTemplatesFromFiles([template]);
    useProjectStore.getState().mergeUserTemplatesFromFiles([personal]);
    useProjectStore.getState().setAppearanceStylesFromFiles([style]);
    let before = useProjectStore.getState();
    before.setDefaultTemplatesFromFiles([structuredClone(template)]);
    before.mergeUserTemplatesFromFiles([structuredClone(personal)]);
    before.setAppearanceStylesFromFiles([structuredClone(style)]);
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(false);
    before = useProjectStore.getState();
    before.setAppearanceStylesFromFiles([{ ...style, name: 'Changed style' }]);
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(true);
    expect(useProjectStore.getState().appearanceStyles[0]?.name).toBe('Changed style');
    before = useProjectStore.getState();
    before.setDefaultTemplatesFromFiles([{ ...template, name: 'Changed default' }]);
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(true);
    expect(useProjectStore.getState().defaultTemplates.find((item) => item.id === template.id)?.name).toBe('Changed default');
    before = useProjectStore.getState();
    before.mergeUserTemplatesFromFiles([{ ...personal, name: 'Changed personal' }]);
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(true);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === personal.id)?.name).toBe('Changed personal');
  });

  it('preserves Set switching, stale active-object repair, and real card and Template changes', () => {
    const first = { id: 'set-a', name: 'A', templateIds: ['template-a'] };
    const second = { id: 'set-b', name: 'B' };
    const template = reconstructMinimalTemplateObject({ id: 'template-a', name: 'Design', templateSource: 'user' });
    useProjectStore.setState({ cardSets: [first, second], activeCardSet: first, userTemplates: [template], storedCards: [
      { uniqueId: 'card-a', templateId: 'template-a', setId: 'set-a', data: { cardName: 'Before' } },
    ] });
    let before = useProjectStore.getState();
    before.setActiveCardSetId(second.id);
    expect(useProjectStore.getState().activeCardSet).toBe(second);
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(true);
    useProjectStore.setState({ activeCardSet: { ...first, name: 'Stale A' } });
    useProjectStore.getState().setActiveCardSetId(first.id);
    expect(useProjectStore.getState().activeCardSet).toBe(first);
    before = useProjectStore.getState();
    const card = selectGeneratedDisplayCards(before)[0]!;
    before.updateGeneratedCard({ ...card, data: { ...card.data, cardName: 'After' } });
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(true);
    expect(useProjectStore.getState().storedCards[0]?.data.cardName).toBe('After');
    before = useProjectStore.getState();
    const savedTemplateId = before.commitTemplateChange({ template: { ...template, name: 'Revised design' }, source: 'user', setId: first.id });
    expect(hasProjectDocumentStateChanged(before, useProjectStore.getState())).toBe(true);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === savedTemplateId)?.name).toBe('Revised design');
  });

  it('distinguishes UI-only store changes from project document changes', () => {
    const expected = useProjectStore.getState();
    useProjectStore.setState({ studioView: expected.studioView === 'template' ? 'generate' : 'template' });
    expect(hasProjectDocumentStateChanged(expected, useProjectStore.getState())).toBe(false);

    useProjectStore.setState({ cardSets: [{ id: 'changed-set', name: 'Changed work' }] });
    expect(hasProjectDocumentStateChanged(expected, useProjectStore.getState())).toBe(true);
  });

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
