import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { applyProjectDocumentToWorkspace } from '@/features/project/client/projectWorkspaceDocument';
import { buildCardForgeProjectSnapshot, createCardForgeProjectPackageBlob } from '@/features/project/lib/projectPackageCodec';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { openRememberedLocalProject } from '@/features/project/client/localFolderWorkingSession';

const binding = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/features/project/client/localProjectFolder', () => ({
  getLocalProjectFileName: () => 'project.cardforge',
  getLocalProjectWorkBinding: async () => binding.current,
}));

beforeEach(async () => {
  await hydrateProjectWorkspaceForScope('account:folder-real-reopen');
  await persistProjectWorkspaceNow();
});

it('reopens a genuinely copied Set without importing its portable identity or changing browser edits', async () => {
  const document = createProjectScaleFixture(100);
  const snapshot = await buildCardForgeProjectSnapshot({ document, name: 'Source' });
  const blob = await createCardForgeProjectPackageBlob(snapshot);
  const file = new File([blob], 'project.cardforge');
  const imported = await applyProjectDocumentToWorkspace(document, 'copy');
  const workId = imported.activeSetId!;
  expect(workId).not.toBe(document.cardSets[0]!.id);
  useProjectStore.setState((state) => ({ cardSets: state.cardSets.map((set) => set.id === workId ? { ...set, name: 'Unsaved browser edit' } : set) }));
  const before = useProjectStore.getState().cardSets;
  binding.current = { workId, sourceRevision: snapshot.manifest.projectRevision,
    handle: { queryPermission: async () => 'granted', getFileHandle: async () => ({ getFile: async () => file }) } };
  await expect(openRememberedLocalProject(workId)).resolves.toEqual({ setId: workId, sourceRevision: snapshot.manifest.projectRevision });
  expect(useProjectStore.getState().cardSets).toEqual(before);
  expect(useProjectStore.getState().cardSets.find((set) => set.id === workId)?.name).toBe('Unsaved browser edit');
});
