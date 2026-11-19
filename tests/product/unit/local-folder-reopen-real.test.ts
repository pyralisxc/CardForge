import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import { PAPER_SIZES } from '@/domain/rendering';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { applyProjectDocumentToWorkspace } from '@/features/project/client/projectWorkspaceDocument';
import { buildCardForgeProjectSnapshot, createCardForgeProjectPackageBlob } from '@/features/project/lib/projectPackageCodec';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { openRememberedLocalProject, type LocalProjectFolderBinding } from '@/features/project/client/localProjectFolder';

const binding = vi.hoisted(() => ({ current: null as LocalProjectFolderBinding | null }));
vi.mock('@/features/project/persistence/structuredBrowserStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/project/persistence/structuredBrowserStorage')>();
  return { ...actual, readStructuredBrowserValue: (key: string) => key.endsWith(`:local-work-folder-binding:${binding.current?.workId}`)
    ? Promise.resolve(binding.current) : actual.readStructuredBrowserValue(key) };
});

beforeEach(async () => {
  binding.current = null;
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
  binding.current = { workId, sourceRevision: snapshot.manifest.projectRevision, folderName: 'Source', lastSavedAt: null,
    handle: { queryPermission: async () => 'granted', getFileHandle: async () => ({ getFile: async () => file }) } as unknown as FileSystemDirectoryHandle };
  await expect(openRememberedLocalProject(workId)).resolves.toEqual({ setId: workId, sourceRevision: snapshot.manifest.projectRevision });
  expect(useProjectStore.getState().cardSets).toEqual(before);
  expect(useProjectStore.getState().cardSets.find((set) => set.id === workId)?.name).toBe('Unsaved browser edit');
});

it('restores moved-out work with real package decoding while preserving unrelated browser content and the folder', async () => {
  const document = createProjectScaleFixture(100);
  const packageOutputPreferences = {
    selectedPaperSize: PAPER_SIZES[1]!,
    pdfMarginMm: 8,
    pdfCardSpacingMm: 3,
    pdfIncludeCutLines: false,
    pdfDuplexLayout: 'same-page' as const,
    exportMode: 'virtual' as const,
    exportDpi: 300,
  };
  document.exportSettings = packageOutputPreferences;
  const unrelated = await applyProjectDocumentToWorkspace(document, 'copy');
  const workspaceOutputPreferences = {
    selectedPaperSize: PAPER_SIZES[0]!,
    pdfMarginMm: 5,
    pdfCardSpacingMm: 1,
    pdfIncludeCutLines: true,
    pdfDuplexLayout: 'separate-pages' as const,
    exportMode: 'physical' as const,
    exportDpi: 150,
  };
  useProjectStore.setState(workspaceOutputPreferences);
  await persistProjectWorkspaceNow();
  const before = useProjectStore.getState();
  expect({
    selectedPaperSize: before.selectedPaperSize,
    pdfMarginMm: before.pdfMarginMm,
    pdfCardSpacingMm: before.pdfCardSpacingMm,
    pdfIncludeCutLines: before.pdfIncludeCutLines,
    pdfDuplexLayout: before.pdfDuplexLayout,
    exportMode: before.exportMode,
    exportDpi: before.exportDpi,
  }).toEqual(workspaceOutputPreferences);
  const snapshot = await buildCardForgeProjectSnapshot({ document, name: 'Saved Set' });
  const blob = await createCardForgeProjectPackageBlob(snapshot);
  const file = new File([blob], 'project.cardforge');
  const createWritable = vi.fn();
  const workId = 'moved-out-set';
  binding.current = { workId, folderName: 'Saved Set', lastSavedAt: null, sourceRevision: snapshot.manifest.projectRevision,
    handle: { queryPermission: async () => 'granted', getFileHandle: async () => ({ getFile: async () => file, createWritable }) } as unknown as FileSystemDirectoryHandle };
  await expect(openRememberedLocalProject(workId)).resolves.toEqual({ setId: workId, sourceRevision: snapshot.manifest.projectRevision });
  const restored = useProjectStore.getState();
  expect(restored.cardSets.find((set) => set.id === workId)?.name).toBe(document.cardSets[0]!.name);
  expect({
    selectedPaperSize: restored.selectedPaperSize,
    pdfMarginMm: restored.pdfMarginMm,
    pdfCardSpacingMm: restored.pdfCardSpacingMm,
    pdfIncludeCutLines: restored.pdfIncludeCutLines,
    pdfDuplexLayout: restored.pdfDuplexLayout,
    exportMode: restored.exportMode,
    exportDpi: restored.exportDpi,
  }).toEqual(workspaceOutputPreferences);
  expect(restored.cardSets.filter((set) => set.id !== workId)).toEqual(before.cardSets);
  expect(restored.storedCards.filter((card) => card.setId !== workId)).toEqual(before.storedCards);
  expect(restored.userTemplates).toEqual(expect.arrayContaining(before.userTemplates));
  const restoredCards = restored.storedCards.filter((card) => card.setId === workId);
  expect(restoredCards).toHaveLength(document.storedCards.length);
  expect(restoredCards[0]!.data).toEqual(document.storedCards[0]!.data);
  const unrelatedTemplateIds = before.storedCards.filter((card) => card.setId === unrelated.activeSetId).map((card) => card.templateId);
  expect(unrelatedTemplateIds).not.toContain(restoredCards[0]!.templateId);
  expect(createWritable).not.toHaveBeenCalled();
  await openRememberedLocalProject(workId);
  expect(useProjectStore.getState().cardSets).toEqual(restored.cardSets);
  expect(useProjectStore.getState().storedCards).toEqual(restored.storedCards);
});
