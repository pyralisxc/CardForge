import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { setProjectPersistenceScope } from '@/features/project/persistence/projectPersistenceScope';
import { useProjectStore } from '@/features/project/store/workspaceStore';
import { buildCardForgeProjectSnapshot, encodeCardForgeProjectPackage } from '@/features/project/lib/projectPackageCodec';

const state = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useCallback: (callback: unknown) => callback,
  useState: () => [state.value, (value: unknown) => { state.value = value; }],
}));
import { useProjectFileActions } from '@/features/project/hooks/useProjectFileActions';

it('imports a legacy multi-Set package as independent Sets even when IDs collide', async () => {
  setProjectPersistenceScope('guest');
  const source = createProjectScaleFixture(100);
  source.cardSets.push({ id: 'second', name: 'Second' });
  source.storedCards = [source.storedCards[0], { ...source.storedCards[1], setId: 'second' }];
  const existing = { id: source.cardSets[0].id, name: 'Existing local Set' };
  useProjectStore.setState({ cardSets: [existing], activeCardSet: existing, storedCards: [], userTemplates: [], appearanceStyles: [] });
  const bytes = await encodeCardForgeProjectPackage(await buildCardForgeProjectSnapshot({ document: source, name: 'Legacy' }));
  const file = new File([Uint8Array.from(bytes).buffer], 'legacy.cardforge');
  const input = { canUseProjectFiles: true, storedCards: [], userTemplates: [], fileInputRef: { current: null }, toast: vi.fn() } as unknown as Parameters<typeof useProjectFileActions>[0];
  useProjectFileActions(input).handleImportProject({ target: { files: [file] } } as never);
  await vi.waitFor(() => expect(state.value).not.toBeNull());
  await useProjectFileActions(input).applyPendingProjectImport('merge');
  const sets = useProjectStore.getState().cardSets;
  expect(sets).toHaveLength(3);
  expect(sets.find((set) => set.id === existing.id)?.name).toBe('Existing local Set');
  expect(sets.filter((set) => set.id !== existing.id).map((set) => set.name)).toEqual(['100 Card Scale Set', 'Second']);
});

it('refuses to silently discard an ambiguous legacy document-level plan', async () => {
  state.value = null;
  setProjectPersistenceScope('guest');
  const source = createProjectScaleFixture(100);
  source.cardSets.push({ id: 'second', name: 'Second' });
  source.productionPlan = { version: 1, decisionMode: 'confirmed', purpose: 'Keep this plan', deliverable: 'Cards', outputSize: { width: 63, height: 88, unit: 'mm' }, visualDirection: { summary: 'Test', palette: [], typography: [] }, editableFieldKeys: [], assets: [] };
  const existing = { id: 'existing', name: 'Existing' };
  useProjectStore.setState({ cardSets: [existing], activeCardSet: existing, storedCards: [], userTemplates: [], appearanceStyles: [] });
  const bytes = await encodeCardForgeProjectPackage(await buildCardForgeProjectSnapshot({ document: source, name: 'Legacy' }));
  const file = new File([Uint8Array.from(bytes).buffer], 'legacy.cardforge');
  const toast = vi.fn();
  const input = { canUseProjectFiles: true, storedCards: [], userTemplates: [], fileInputRef: { current: null }, toast } as unknown as Parameters<typeof useProjectFileActions>[0];
  useProjectFileActions(input).handleImportProject({ target: { files: [file] } } as never);
  await vi.waitFor(() => expect(state.value).not.toBeNull());
  await useProjectFileActions(input).applyPendingProjectImport('merge');
  expect(useProjectStore.getState().cardSets).toEqual([existing]);
  expect(toast.mock.calls.at(-1)?.[0].description).toMatch(/plan/i);
});

it('does not create legacy copies when catalog references cannot be remapped safely', async () => {
  const source = createProjectScaleFixture(100);
  source.cardSets.push({ id: 'second', name: 'Second' });
  source.customAssets['cardforge-maker-custom-images'] = [{ id: 'art', name: 'Art', url: 'data:image/png;base64,AQ==', kind: 'image' } as never];
  const existing = { id: 'existing', name: 'Existing' };
  useProjectStore.setState({ cardSets: [existing], activeCardSet: existing, storedCards: [], userTemplates: [], appearanceStyles: [] });
  state.value = { document: source };
  const toast = vi.fn();
  const input = { canUseProjectFiles: true, storedCards: [], userTemplates: [], toast } as unknown as Parameters<typeof useProjectFileActions>[0];
  await useProjectFileActions(input).applyPendingProjectImport('merge');
  expect(useProjectStore.getState().cardSets).toEqual([existing]);
  expect(toast.mock.calls.at(-1)?.[0].description).toMatch(/resource/i);
});
