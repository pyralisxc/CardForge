import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetPlan } from '@/domain/cards';
import { normalizeProjectProductionPlan } from '@/domain/cards';
import { applyCardSetPlan, applyProjectDocumentToWorkspace, captureCardSetProjectDocument, captureCurrentProjectDocument } from '@/features/project/client/projectWorkspaceDocument';
import { buildCardForgeProjectSnapshot, encodeCardForgeProjectPackage, decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import { createProjectDocumentFromState } from '@/features/project/model/projectDocument';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { createBrowserKeyValueStorage } from '@/features/project/persistence/indexedDbStorage';
import { getBrowserProjectAssetIds } from '@/features/project/persistence/contentAddressedBrowserAssets';
import { mapProjectDocumentIdentity, type ProjectDocumentIdentityMap } from '@/features/project/model/projectDocumentIdentity';
import { importRetainedGuestWorkspaceAsCopy } from '@/features/project/client/retainedGuestWorkspace';

let ordinal = 0;
let scope: `account:${string}`;
const original: SetPlan = { version: 1, context: 'Original intent', custom: { preserved: ['A decision'] } };
const brief = normalizeProjectProductionPlan({
  version: 1, purpose: 'Create readable cards', deliverable: 'A card Set', decisionMode: 'confirmed',
  outputSize: { width: 630, height: 880, unit: 'px' },
  visualDirection: { summary: 'Quiet typography', palette: [], typography: [] }, editableFieldKeys: [], assets: [],
})!;
const owner = () => useProjectStore.getState().cardSets.find((set) => set.id === 'context-a')!;
const apply = (plan: SetPlan, expectedPlan: SetPlan | undefined = owner().plan, signal?: AbortSignal) => applyCardSetPlan({ setId: 'context-a', expectedScope: scope, expectedPlan, plan, signal });
const storage = () => createBrowserKeyValueStorage(`project-workspace:${scope}`);

describe('Set context native lifecycle', () => {
  beforeEach(async () => {
    scope = `account:set-context-${++ordinal}`;
    await hydrateProjectWorkspaceForScope(scope);
    const first = { id: 'context-a', name: 'First Set', plan: structuredClone(original) };
    useProjectStore.setState({ cardSets: [first, { id: 'context-b', name: 'Unrelated Set', plan: { version: 1, context: 'Keep this unchanged' } }], activeCardSet: first, storedCards: [], userTemplates: [], appearanceStyles: [] });
    await persistProjectWorkspaceNow();
  });
  afterEach(() => vi.restoreAllMocks());

  it('edits and reopens literal authored context without resolving it as artwork', async () => {
    const unrelated = useProjectStore.getState().cardSets[1];
    const next: SetPlan = { ...original, context: 'data:image/png;base64,not an image', custom: { example: `cardforge-browser-asset://${'a'.repeat(64)}` } };
    await apply(next);
    expect(owner().plan).toEqual(next);
    expect(useProjectStore.getState().activeCardSet?.plan).toEqual(next);
    expect(useProjectStore.getState().cardSets[1]).toEqual(unrelated);
    const saved = (await storage().getItem('workspace'))!;
    expect(getBrowserProjectAssetIds(saved)).toEqual([]);
    const savedScope = scope;
    await hydrateProjectWorkspaceForScope(`account:away-${ordinal}`);
    await hydrateProjectWorkspaceForScope(savedScope);
    expect(owner().plan).toEqual(next);
    expect((await captureCurrentProjectDocument()).cardSets.find((set) => set.id === 'context-a')?.plan).toEqual(next);
  });

  it('preserves both revisions when an editor baseline is stale', async () => {
    const expected = structuredClone(owner().plan);
    await apply({ ...original, context: 'Newer accepted context' });
    const state = useProjectStore.getState();
    const saved = await storage().getItem('workspace');
    await expect(apply({ ...original, context: 'Stale draft' }, expected)).rejects.toThrow(/changed while/i);
    expect(useProjectStore.getState()).toBe(state);
    expect(await storage().getItem('workspace')).toBe(saved);
  });

  it('leaves future-version browser work byte-for-byte unchanged and refuses hydration', async () => {
    const futureScope = `account:future-${ordinal}` as const;
    const futureStorage = createBrowserKeyValueStorage(`project-workspace:${futureScope}`);
    const saved = JSON.stringify({ version: 7, state: { cardSets: [{ id: 'future', name: 'Future Set', plan: original }], futureAuthoredData: { keep: ['all bytes'] } } });
    await futureStorage.setItem('workspace', saved);
    await expect(hydrateProjectWorkspaceForScope(futureScope)).rejects.toThrow(/newer CardForge version/i);
    expect(await futureStorage.getItem('workspace')).toBe(saved);
    expect(useProjectStore.persist.hasHydrated()).toBe(false);
  });

  it('does not apply the old account draft to a same-ID Set after switching accounts', async () => {
    const expectedScope = scope;
    const expectedPlan = owner().plan;
    await hydrateProjectWorkspaceForScope(`account:different-${ordinal}`);
    useProjectStore.setState({ cardSets: [{ id: 'context-a', name: 'Other account' }] });
    await persistProjectWorkspaceNow();
    const state = useProjectStore.getState();
    await expect(applyCardSetPlan({ setId: 'context-a', expectedScope, expectedPlan, plan: original })).rejects.toThrow(/account changed/i);
    expect(useProjectStore.getState()).toBe(state);
  });

  it('leaves live and durable context unchanged after an aborted native transaction', async () => {
    const saved = await storage().getItem('workspace');
    const state = useProjectStore.getState();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      if (key === `project-workspace:${scope}:workspace`) request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(apply({ ...original, context: 'Never committed' })).rejects.toThrow();
    expect(useProjectStore.getState()).toBe(state);
    expect(await storage().getItem('workspace')).toBe(saved);
  });

  it('copies an unambiguous legacy brief into its independent Set owner', async () => {
    const document = createProjectDocumentFromState({ cardSets: [{ id: 'context-a', name: 'Legacy Set' }], storedCards: [], userTemplates: [], appearanceStyles: [], productionPlan: brief });
    expect(document.productionPlan).toBeDefined();
    const installed = await applyProjectDocumentToWorkspace(document, 'copy');
    expect(installed.activeSetId).not.toBe('context-a');
    expect(useProjectStore.getState().cardSets.find((set) => set.id === installed.activeSetId)?.plan).toEqual({ version: 1, context: '', brief });
    expect(owner().plan).toEqual(original);
    expect(document.cardSets[0].plan).toBeUndefined();
    expect((await captureCurrentProjectDocument()).productionPlan).toBeUndefined();
  });

  it('keeps brief-only artwork through provider Open, native recapture and portable Save identity', async () => {
    const imageKey = 'cardforge-maker-custom-images';
    const asset = { id: 'portable-art', name: 'Only brief art', kind: 'image' as const, tileMode: 'contain' as const, seamless: false, allowedTargets: [], url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZxQAAAAASUVORK5CYII=' };
    const plan: SetPlan = { version: 1, context: 'Keep', brief: { ...brief, assets: [{ id: 'art', name: 'Art', kind: 'image', role: 'Face', source: 'user-provided', status: 'selected', quantity: 1, assetId: asset.id }] } };
    const document = createProjectDocumentFromState({ cardSets: [{ id: 'portable-set', name: 'Provider Set', plan }], storedCards: [], userTemplates: [], appearanceStyles: [], customImageAssets: [asset] });
    const identities: ProjectDocumentIdentityMap = {};
    const opened = mapProjectDocumentIdentity(document, identities, 'open');
    await applyProjectDocumentToWorkspace(opened, 'adopt');
    const captured = await captureCardSetProjectDocument(opened.cardSets[0].id);
    expect(captured.customAssets[imageKey]).toHaveLength(1);
    expect(captured.cardSets[0].plan?.brief?.assets[0].assetId).toBe(captured.customAssets[imageKey][0].id);
    const saved = mapProjectDocumentIdentity(captured, identities, 'save');
    expect(saved.customAssets[imageKey][0].id).toBe(asset.id);
    expect(saved.cardSets[0].plan).toEqual(document.cardSets[0].plan);
  });

  it.each(['context', 'metadata', 'external-brief'])('does not capture unrelated personal artwork from literal %s', async (kind) => {
    const asset = { id: 'private-art', name: 'Unrelated private artwork', kind: 'image' as const, tileMode: 'contain' as const, seamless: false, allowedTargets: [], url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZxQAAAAASUVORK5CYII=' };
    const plan: SetPlan = { version: 1, context: kind === 'context' ? asset.url : '', ...(kind === 'metadata' ? { example: asset.id } : {}), ...(kind === 'external-brief' ? { brief: { ...brief, assets: [{ id: 'external', name: 'Library artwork', kind: 'image' as const, role: 'Face', source: 'cardforge-library' as const, status: 'selected' as const, quantity: 1, assetId: asset.id }] } } : {}) };
    const document = createProjectDocumentFromState({ cardSets: [{ id: 'literal-only', name: 'Literal context', plan }], storedCards: [], userTemplates: [], appearanceStyles: [], customImageAssets: [asset] });
    await applyProjectDocumentToWorkspace(document, 'adopt');
    const captured = await captureCardSetProjectDocument('literal-only');
    expect(captured.customAssets['cardforge-maker-custom-images']).toEqual([]);
    expect(captured.cardSets[0].plan).toEqual(document.cardSets[0].plan);
  });

  it('downloads/imports one complete native Set without replacing its source or unrelated work', async () => {
    const context = { ...original, context: 'Literal data:image/png;base64,not an image', custom: { sample: `cardforge-project-asset://${'a'.repeat(64)}` } };
    await apply(context);
    const source = await captureCardSetProjectDocument('context-a');
    expect(source.cardSets.map((set) => set.id)).toEqual(['context-a']);
    const archive = await encodeCardForgeProjectPackage(await buildCardForgeProjectSnapshot({ document: source, name: 'Complete Set' }));
    const reopened = hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(archive));
    const installed = await applyProjectDocumentToWorkspace(reopened, 'copy');
    expect(owner().plan).toEqual(context);
    expect(useProjectStore.getState().cardSets.find((set) => set.id === 'context-b')?.plan?.context).toBe('Keep this unchanged');
    expect(installed.activeSetId).not.toBe('context-a');
    const copied = useProjectStore.getState().cardSets.find((set) => set.id === installed.activeSetId)!;
    expect(copied.plan).toEqual(context);
    await applyCardSetPlan({ setId: copied.id, expectedScope: scope, expectedPlan: copied.plan, plan: { ...copied.plan!, context: 'Only the copy changed' } });
    expect(owner().plan).toEqual(context);
  });

  it('round-trips every native Set context through a separate whole-workspace backup/restore', async () => {
    const captured = await captureCurrentProjectDocument();
    const archive = await encodeCardForgeProjectPackage(await buildCardForgeProjectSnapshot({ document: captured, name: 'Workspace backup' }));
    await hydrateProjectWorkspaceForScope(`account:restore-${ordinal}`);
    await applyProjectDocumentToWorkspace(hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(archive)), 'replace');
    expect(useProjectStore.getState().cardSets.map((set) => ({ id: set.id, plan: set.plan }))).toEqual(captured.cardSets.map((set) => ({ id: set.id, plan: set.plan })));
  });

  it('imports retained signed-out context as an independent account copy before consuming it', async () => {
    const guest = createBrowserKeyValueStorage('project-workspace:guest');
    await guest.setItem('workspace', JSON.stringify({ version: 6, state: { cardSets: [{ id: 'guest-context', name: 'Signed-out work', plan: original }], storedCards: [], userTemplates: [], appearanceStyles: [] } }));
    const imported = await importRetainedGuestWorkspaceAsCopy();
    expect(imported.consumed).toBe(true);
    expect(imported.importedSetId).not.toBe('guest-context');
    expect(useProjectStore.getState().cardSets.find((set) => set.id === imported.importedSetId)?.plan).toEqual(original);
    expect(owner().plan).toEqual(original);
    expect(await guest.getItem('workspace')).toBeNull();
  });

  it.each([
    { version: 7, plan: original },
    { version: 6, plan: { version: 99, context: 'Future context' } },
  ])('leaves unsupported retained signed-out work and account bytes unchanged (%j)', async ({ version, plan }) => {
    const guest = createBrowserKeyValueStorage('project-workspace:guest');
    await guest.setItem('workspace', JSON.stringify({ version, state: { cardSets: [{ id: 'guest-context', name: 'Signed-out work', plan }], storedCards: [], userTemplates: [] } }));
    const source = await guest.getItem('workspace');
    const account = await storage().getItem('workspace');
    const state = useProjectStore.getState();
    await expect(importRetainedGuestWorkspaceAsCopy()).rejects.toThrow(/newer|unsupported/i);
    expect(useProjectStore.getState()).toBe(state);
    expect(await storage().getItem('workspace')).toBe(account);
    expect(await guest.getItem('workspace')).toBe(source);
  });

  it('does not clear creator context when an older agent draft updates a matching Set', async () => {
    await apply({ ...original, brief });
    const document = createProjectDocumentFromState({ cardSets: [{ id: 'context-a', name: 'First Set' }], storedCards: [], userTemplates: [], appearanceStyles: [], productionPlan: brief });
    await applyProjectDocumentToWorkspace(document, 'adopt');
    expect(owner().plan).toEqual({ ...original, brief });
  });

  it('keeps native context when an agent revision has neither plan nor legacy brief', async () => {
    const document = createProjectDocumentFromState({ cardSets: [{ id: 'context-a', name: 'Agent revision' }], storedCards: [], userTemplates: [], appearanceStyles: [] });
    await applyProjectDocumentToWorkspace(document, 'adopt');
    expect(owner().plan).toEqual(original);
    expect((await captureCurrentProjectDocument()).cardSets.find((set) => set.id === 'context-a')?.plan).toEqual(original);
  });

  it('defers an agent plan that differs from creator context instead of treating newer cards as plan consent', async () => {
    await apply({ ...original, context: 'Creator edited notes', brief });
    const document = createProjectDocumentFromState({ cardSets: [{ id: 'context-a', name: 'Agent revision', plan: { ...original, context: 'Old agent notes', brief } }], storedCards: [], userTemplates: [], appearanceStyles: [] });
    const state = useProjectStore.getState();
    const saved = await storage().getItem('workspace');
    await expect(applyProjectDocumentToWorkspace(document, 'adopt')).rejects.toThrow(/context.*different|different.*context/i);
    expect(useProjectStore.getState()).toBe(state);
    expect(await storage().getItem('workspace')).toBe(saved);
    expect(document.cardSets[0].plan?.context).toBe('Old agent notes');
    await expect(applyProjectDocumentToWorkspace(document, 'copy')).resolves.toBeDefined();
    expect(owner().plan?.context).toBe('Creator edited notes');
  });

  it('defers a conflicting legacy brief instead of overwriting a creator’s edited plan', async () => {
    await apply({ ...original, brief: { ...brief, purpose: 'Creator’s revised purpose' } });
    const document = createProjectDocumentFromState({ cardSets: [{ id: 'context-a', name: 'First Set' }], storedCards: [], userTemplates: [], appearanceStyles: [], productionPlan: brief });
    const state = useProjectStore.getState();
    const saved = await storage().getItem('workspace');
    await expect(applyProjectDocumentToWorkspace(document, 'adopt')).rejects.toThrow(/different creation brief/i);
    expect(useProjectStore.getState()).toBe(state);
    expect(await storage().getItem('workspace')).toBe(saved);
  });

  it.each([0, 2])('refuses a legacy brief with %i possible owners without using the active Set', async (count) => {
    const document = createProjectDocumentFromState({ cardSets: Array.from({ length: count }, (_, i) => ({ id: `legacy-${i}`, name: `Legacy ${i}` })), storedCards: [], userTemplates: [], appearanceStyles: [], productionPlan: brief });
    const state = useProjectStore.getState();
    const saved = await storage().getItem('workspace');
    await expect(applyProjectDocumentToWorkspace(document, 'copy')).rejects.toThrow(/unambiguous Set owner/i);
    expect(useProjectStore.getState()).toBe(state);
    expect(await storage().getItem('workspace')).toBe(saved);
    expect(document.productionPlan).toEqual(brief);
  });
});
