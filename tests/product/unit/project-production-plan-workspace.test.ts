import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { applyWorkspaceBackupToWorkspace, captureCurrentWorkspaceBackup, applyProjectDocumentToWorkspace, captureCurrentProjectDocument, captureCardSetProjectDocument, cleanCurrentWorkspaceCompletedDeletions } from '@/features/project/client/projectWorkspaceDocument';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { createProjectDocumentFromState, isolateProjectDocumentToSet } from '@/features/project/model/projectDocument';

it('retains an imported document production plan after leaving and reopening its workspace', async () => {
  const plan = {
    version: 1 as const, decisionMode: 'confirmed' as const, purpose: 'Cards', deliverable: 'Set',
    outputSize: { width: 630, height: 880, unit: 'px' as const },
    visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [],
  };
  const document = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], productionPlan: plan });
  await hydrateProjectWorkspaceForScope('account:plan-retention');
  await applyProjectDocumentToWorkspace(document, 'replace');
  await persistProjectWorkspaceNow();
  await hydrateProjectWorkspaceForScope('account:plan-other');
  await hydrateProjectWorkspaceForScope('account:plan-retention');
  expect((await captureCurrentProjectDocument()).productionPlan).toEqual(expect.objectContaining(plan));
});


it('rejects a partial Set export of a multi-Set planned document without losing its plan', async () => {
  const plan = { version: 1 as const, decisionMode: 'confirmed' as const, purpose: 'Whole document', deliverable: 'Cards', outputSize: { width: 1, height: 1, unit: 'px' as const }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [] };
  const document = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], cardSets: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], productionPlan: plan });
  await hydrateProjectWorkspaceForScope('account:plan-partial');
  await applyProjectDocumentToWorkspace(document, 'replace');
  await expect(captureCardSetProjectDocument('a')).rejects.toThrow(/plan/i);
  expect((await captureCurrentProjectDocument()).productionPlan).toEqual(expect.objectContaining(plan));
});

it('rejects merging a planned document into existing work without changing that work', async () => {
  const base = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], cardSets: [{ id: 'existing', name: 'Existing' }] });
  const incoming = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], productionPlan: { version: 1, decisionMode: 'confirmed', purpose: 'Incoming', deliverable: 'Cards', outputSize: { width: 1, height: 1, unit: 'px' }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [] } });
  await hydrateProjectWorkspaceForScope('account:plan-merge');
  await applyProjectDocumentToWorkspace(base, 'replace');
  await expect(applyProjectDocumentToWorkspace(incoming, 'merge')).rejects.toThrow(/plan/i);
  expect((await captureCurrentProjectDocument()).cardSets.map(set => set.id)).toEqual(['existing']);
});

it('rejects partial isolation at the portable document boundary', () => {
  const document = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], cardSets: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], productionPlan: { version: 1, decisionMode: 'confirmed', purpose: 'Whole', deliverable: 'Cards', outputSize: { width: 1, height: 1, unit: 'px' }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [] } });
  expect(() => isolateProjectDocumentToSet(document, 'a')).toThrow(/plan/i);
});

const lifecyclePlan = { version: 1 as const, decisionMode: 'confirmed' as const, purpose: 'Original', deliverable: 'Cards', outputSize: { width: 1, height: 1, unit: 'px' as const }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [] };

it('allows account bootstrap after adding a Set to planned work', async () => {
  await hydrateProjectWorkspaceForScope('account:plan-bootstrap-new-set');
  await applyProjectDocumentToWorkspace(createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], cardSets: [{ id: 'original', name: 'Original' }], productionPlan: lifecyclePlan }), 'replace');
  useProjectStore.getState().createCardSet('New');
  await persistProjectWorkspaceNow();
  await hydrateProjectWorkspaceForScope('account:other-bootstrap');
  await hydrateProjectWorkspaceForScope('account:plan-bootstrap-new-set');
  await expect(cleanCurrentWorkspaceCompletedDeletions()).resolves.toBeUndefined();
});

it('preserves a zero-Set plan when a Set is subsequently created and backed up', async () => {
  await hydrateProjectWorkspaceForScope('account:zero-plan-new-set');
  await applyProjectDocumentToWorkspace(createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], productionPlan: lifecyclePlan }), 'replace');
  useProjectStore.getState().createCardSet('New');
  const backup = await captureCurrentWorkspaceBackup();
  const { encodeWorkspaceBackupPackage, decodeWorkspaceBackupPackage } = await import('@/features/project/lib/workspaceBackupPackageCodec');
  const bytes = await encodeWorkspaceBackupPackage(backup, 'Backup');
  const decoded = await decodeWorkspaceBackupPackage(bytes);
  await hydrateProjectWorkspaceForScope('account:zero-plan-restored');
  await applyWorkspaceBackupToWorkspace(decoded, 'replace');
  expect(useProjectStore.getState().documentPlanGroups).toEqual([{ setIds: [], plan: lifecyclePlan }]);
  expect(useProjectStore.getState().cardSets).toHaveLength(1);
});

it('adopts a planned document into an empty workspace without losing the plan', async () => {
  await hydrateProjectWorkspaceForScope('account:empty-adoption');
  const incoming = createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], cardSets: [{ id: 'adopted', name: 'Adopted' }], productionPlan: lifecyclePlan });
  await applyProjectDocumentToWorkspace(incoming, 'adopt');
  expect((await captureCurrentProjectDocument()).productionPlan).toEqual(expect.objectContaining(lifecyclePlan));
});


it('does not invent a Set when opening a zero-Set planned document', async () => {
  await hydrateProjectWorkspaceForScope('account:zero-plan-no-synthetic-set');
  await applyProjectDocumentToWorkspace(createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], productionPlan: lifecyclePlan }), 'replace');
  expect(useProjectStore.getState().cardSets).toEqual([]);
});

it('does not consume retained guest work containing an unrepresentable plan', async () => {
  const { createIndexedDbStorage } = await import('@/features/project/persistence/indexedDbStorage');
  const { importRetainedGuestWorkspaceAsCopy } = await import('@/features/project/client/retainedGuestWorkspace');
  const guest = createIndexedDbStorage('project-workspace:guest');
  const guestRaw = JSON.stringify({ state: { cardSets: [{ id: 'guest-set', name: 'Guest' }], storedCards: [], userTemplates: [], documentPlanGroups: [{ setIds: ['guest-set'], plan: lifecyclePlan }] }, version: 4 });
  await guest.setItem('workspace', guestRaw);
  await hydrateProjectWorkspaceForScope('account:retained-plan-guard');
  await persistProjectWorkspaceNow();
  await expect(importRetainedGuestWorkspaceAsCopy()).rejects.toThrow(/plan/i);
  expect(await guest.getItem('workspace')).toBe(guestRaw);
});
