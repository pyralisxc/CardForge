import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { useProjectStore } from '@/features/project/store/workspaceStore';
import { setProjectPersistenceScope } from '@/features/project/persistence/projectPersistenceScope';
import { getProjectAssetStorage } from '@/features/project/persistence/projectAssets';
import { decodeCardForgeProjectPackage, encodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useCallback: (callback: unknown) => callback,
  useState: (value: unknown) => [value, () => {}],
}));
const saved = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/features/project/client/projectPackageDeviceSave', () => ({ saveCardForgeProjectPackageToDevice: saved.save }));
import { useProjectFileActions } from '@/features/project/hooks/useProjectFileActions';

it('downloads only the active Set, its shared template and its artwork in a real package roundtrip', async () => {
  setProjectPersistenceScope('guest');
  const source = createProjectScaleFixture(100, { uniqueArtwork: true });
  const a = { ...source.cardSets[0], name: 'First', templateIds: ['scale-template'] };
  const b = { id: 'second', name: 'Second', templateIds: ['scale-template', 'other-template'] };
  const first = { ...source.storedCards[0], data: { ...source.storedCards[0].data, assetChoice: 'used-image' } };
  await getProjectAssetStorage().setItem('cardforge-maker-custom-images', JSON.stringify([
    { id: 'used-image', name: 'Used', url: 'data:image/png;base64,AQ==', kind: 'image' },
    { id: 'unused-image', name: 'Unused', url: 'data:image/png;base64,Ag==', kind: 'image' },
  ]));
  const second = { ...source.storedCards[1], setId: b.id, templateId: 'other-template' };
  const other = { ...source.userTemplates[0], id: 'other-template' };
  useProjectStore.setState({ cardSets: [a, b], activeCardSet: a, storedCards: [first, second], userTemplates: [source.userTemplates[0], other], appearanceStyles: [] });
  const toast = vi.fn();
  const actions = useProjectFileActions({ canUseProjectFiles: true, storedCards: [first, second], userTemplates: [], toast } as unknown as Parameters<typeof useProjectFileActions>[0]);
  await actions.handleExportProject();
  expect(saved.save).toHaveBeenCalledOnce();
  const { fileName, snapshot } = saved.save.mock.calls[0][0];
  expect(fileName).toBe('First.cardforge');
  const reopened = hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(await encodeCardForgeProjectPackage(snapshot)));
  expect(reopened.cardSets.map((set) => set.id)).toEqual([a.id]);
  expect(reopened.storedCards.map((card) => card.uniqueId)).toEqual([first.uniqueId]);
  expect(reopened.storedCards[0].data.artwork).toBe(source.storedCards[0].data.artwork);
  expect(reopened.userTemplates.map((template) => template.id)).toEqual(['scale-template']);
  expect(reopened.customAssets['cardforge-maker-custom-images'].map((asset) => asset.id)).toEqual(['used-image']);
  expect(snapshot.assets.size).toBe(2);
});
