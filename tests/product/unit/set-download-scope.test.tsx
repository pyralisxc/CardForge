import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { getProjectPersistenceScope, setProjectPersistenceScope } from '@/features/project/persistence/projectPersistenceScope';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { applyCardSetPlan, applyProjectDocumentToWorkspace } from '@/features/project/client/projectWorkspaceDocument';
import { decodeCardForgeProjectPackage, encodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import type { CardForgeProjectPackageSnapshot } from '@/features/project/model/projectPackage';

const boundary = vi.hoisted(() => ({ save: vi.fn(), started: vi.fn(), completed: vi.fn() }));
vi.mock('@/features/project/client/projectPackageDeviceSave', () => ({ saveCardForgeProjectPackageToDevice: boundary.save }));
vi.mock('@/features/analytics/client/tracking', () => ({ trackExportStarted: boundary.started, trackExportCompleted: boundary.completed }));
import { useProjectFileActions } from '@/features/project/hooks/useProjectFileActions';

type Input = Parameters<typeof useProjectFileActions>[0];
let exportSet: (() => Promise<void>) | undefined;
function HookHost({ input }: { input: Input }) {
  // The server-rendered test harness captures the hook's action for invocation.
  // eslint-disable-next-line react-hooks/globals
  exportSet = useProjectFileActions(input).handleExportProject;
  return null;
}

const renderAction = (toast: ReturnType<typeof vi.fn>) => {
  renderToStaticMarkup(createElement(HookHost, { input: { canUseProjectFiles: true, storedCards: useProjectStore.getState().storedCards, toast } as unknown as Input }));
  expect(exportSet).toBeDefined();
  return exportSet!();
};

describe('Set download scope', () => {
  afterEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
    vi.clearAllMocks();
    exportSet = undefined;
  });

  it('downloads only the selected Set and all its prepared, front and back designs', async () => {
    await hydrateProjectWorkspaceForScope('guest');
    const fixture = createProjectScaleFixture(100, { uniqueArtwork: true });
    const plan = { version: 1 as const, context: '  Literal data:image/png;base64,not an image\n\n', custom: { sample: `cardforge-project-asset://${'a'.repeat(64)}` } };
    const selected = { ...fixture.cardSets[0], templateIds: ['scale-template', 'prepared', 'back'], plan };
    const other = { id: 'other-set', name: 'Private Other Set', templateIds: ['other-template'] };
    const base = fixture.userTemplates[0];
    const back = { ...base, id: 'back', name: 'Back', templateUsage: 'back-preset' as const };
    const prepared = { ...base, id: 'prepared', name: 'Prepared design' };
    const otherTemplate = { ...base, id: 'other-template', name: 'Private design' };
    const card = { ...fixture.storedCards[0], backingTemplateId: 'back', backingData: { name: 'Back text' } };
    const otherCard = { ...fixture.storedCards[1], uniqueId: 'other-card', setId: other.id, templateId: otherTemplate.id };
    useProjectStore.setState({ cardSets: [selected, other], activeCardSet: selected, userTemplates: [base, back, prepared, otherTemplate], storedCards: [card, otherCard] });
    await persistProjectWorkspaceNow();
    boundary.save.mockResolvedValue('download');
    const toast = vi.fn();
    await renderAction(toast);
    expect(boundary.save, JSON.stringify(toast.mock.calls)).toHaveBeenCalledOnce();
    const { snapshot, fileName } = boundary.save.mock.calls[0][0] as { snapshot: CardForgeProjectPackageSnapshot; fileName: string };
    const decoded = hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(await encodeCardForgeProjectPackage(snapshot)));
    expect(fileName).toBe(`${selected.name}.cardforge`);
    expect(decoded.cardSets.map((set) => set.id)).toEqual([selected.id]);
    expect(decoded.cardSets[0].plan).toEqual(plan);
    expect(decoded.storedCards.map((item) => item.uniqueId)).toEqual([card.uniqueId]);
    expect(decoded.storedCards[0].data).toEqual(card.data);
    expect(decoded.storedCards[0].backingData).toEqual(card.backingData);
    expect(decoded.userTemplates.map((item) => item.id).sort()).toEqual(['back', 'prepared', 'scale-template']);
    expect(snapshot.manifest.assets.length).toBeGreaterThan(0);
    expect(JSON.stringify(decoded)).not.toContain('Private Other Set');
    const imported = await applyProjectDocumentToWorkspace(decoded, 'copy');
    const reopened = useProjectStore.getState();
    expect(imported.activeSetId).not.toBe(selected.id);
    expect(reopened.cardSets.map((set) => set.id)).toContain(other.id);
    expect(reopened.storedCards.find((item) => item.uniqueId === otherCard.uniqueId)).toEqual(otherCard);
    const importedCard = reopened.storedCards.find((item) => item.setId === imported.activeSetId);
    expect(importedCard?.data).toEqual(card.data);
    expect(importedCard?.backingData).toEqual(card.backingData);
    expect(importedCard?.templateId).not.toBe(card.templateId);
    const importedSet = reopened.cardSets.find((set) => set.id === imported.activeSetId)!;
    expect(importedSet.plan).toEqual(plan);
    await applyCardSetPlan({ setId: importedSet.id, expectedScope: getProjectPersistenceScope(), expectedPlan: importedSet.plan, plan: { ...plan, context: 'Only the copy changed' } });
    expect(useProjectStore.getState().cardSets.find((set) => set.id === selected.id)?.plan).toEqual(plan);
    expect(useProjectStore.getState().cardSets.find((set) => set.id === other.id)).toEqual(other);
  });

  it('does not download a different Set when no Set is selected', async () => {
    setProjectPersistenceScope('guest');
    const fixture = createProjectScaleFixture(100);
    useProjectStore.setState({ cardSets: fixture.cardSets, activeCardSet: null, userTemplates: fixture.userTemplates, storedCards: fixture.storedCards });
    const toast = vi.fn();
    await renderAction(toast);
    expect(boundary.save).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Set not downloaded' }));
  });

  it('does not download when the selected Set is no longer in the workspace', async () => {
    setProjectPersistenceScope('guest');
    const fixture = createProjectScaleFixture(100);
    useProjectStore.setState({ cardSets: fixture.cardSets, activeCardSet: { id: 'missing', name: 'Missing' }, userTemplates: fixture.userTemplates, storedCards: fixture.storedCards });
    const toast = vi.fn();
    await renderAction(toast);
    expect(boundary.save).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Set not downloaded', variant: 'destructive' }));
  });

  it('does not download an incomplete package when selected artwork cannot be read', async () => {
    setProjectPersistenceScope('guest');
    const fixture = createProjectScaleFixture(100);
    const card = { ...fixture.storedCards[0], data: { artwork: `cardforge-browser-asset://${'a'.repeat(64)}` } };
    useProjectStore.setState({ cardSets: fixture.cardSets, activeCardSet: fixture.cardSets[0], userTemplates: fixture.userTemplates, storedCards: [card] });
    const toast = vi.fn();
    await renderAction(toast);
    expect(boundary.save).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Set not downloaded', variant: 'destructive' }));
  });

  it.each(['prepared', 'front', 'back'] as const)('refuses to download when a %s Template is missing', async (missing) => {
    setProjectPersistenceScope('guest');
    const fixture = createProjectScaleFixture(100);
    const selected = { ...fixture.cardSets[0], templateIds: missing === 'prepared' ? ['missing-template'] : [] };
    const card = { ...fixture.storedCards[0], templateId: missing === 'front' ? 'missing-template' : 'scale-template', backingTemplateId: missing === 'back' ? 'missing-template' : null };
    useProjectStore.setState({ cardSets: [selected], activeCardSet: selected, userTemplates: fixture.userTemplates, storedCards: [card] });
    const toast = vi.fn();
    await renderAction(toast);
    expect(boundary.save).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Set not downloaded', variant: 'destructive' }));
  });
});
