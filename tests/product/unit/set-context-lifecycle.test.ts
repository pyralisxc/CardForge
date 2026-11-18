import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetPlan } from '@/domain/cards';
import { normalizeProjectProductionPlan } from '@/domain/cards';
import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { applyCardSetPlan, applyProjectDocumentToWorkspace, captureCardSetProjectDocument, captureCurrentProjectDocument } from '@/features/project/client/projectWorkspaceDocument';
import { buildCardForgeProjectSnapshot, encodeCardForgeProjectPackage, decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import { createProjectDocumentFromState, type ProjectDocumentV1 } from '@/features/project/model/projectDocument';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { createBrowserKeyValueStorage } from '@/features/project/persistence/indexedDbStorage';
import { parseBrowserWorkspaceRecord } from '@/features/project/persistence/workspaceRevision';
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
const placementTemplate = (id = 'placement-template') => reconstructMinimalTemplateObject({
  id,
  name: 'Placement Template',
  aspectRatio: '63:88',
  templateSource: 'user',
  templateLineageId: `${id}-lineage`,
  templateRevisionId: `${id}-revision`,
  freeformCanvas: { width: 630, height: 880, elements: [] },
});
const placementOrganization = (templatePositions?: Record<string, { x: number; y: number }>) => ({
  arrangement: 'manual' as const,
  groupBy: 'none' as const,
  sort: 'manual' as const,
  tags: [],
  positions: {},
  ...(templatePositions !== undefined ? { templatePositions } : {}),
});

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
    const saved = JSON.stringify({ version: 10, state: { cardSets: [{ id: 'future', name: 'Future Set', plan: original }], futureAuthoredData: { keep: ['all bytes'] } } });
    await futureStorage.setItem('workspace', saved);
    await expect(hydrateProjectWorkspaceForScope(futureScope)).rejects.toThrow(/newer CardForge version/i);
    expect(await futureStorage.getItem('workspace')).toBe(saved);
    expect(useProjectStore.persist.hasHydrated()).toBe(false);
  });

  it('persists version-6 shared-template migration and keeps remapped identities stable after rehydration', async () => {
    const migrationScope = `account:template-migration-${ordinal}` as const;
    const savedStorage = createBrowserKeyValueStorage(`project-workspace:${migrationScope}`);
    const original = {
      id: 'shared-legacy-template',
      name: 'Shared source',
      aspectRatio: '63:88',
      templateSource: 'default',
      freeformCanvas: { width: 630, height: 880, elements: [] },
    };
    await savedStorage.setItem('workspace', JSON.stringify({
      version: 6,
      state: {
        userTemplates: [original],
        cardSets: [
          {
            id: 'legacy-a', name: 'Legacy A', templateIds: [original.id],
            organization: { arrangement: 'manual', groupBy: 'none', sort: 'manual', tags: [], positions: {}, templatePositions: { [original.id]: { x: -5, y: 7 } } },
          },
          {
            id: 'legacy-b', name: 'Legacy B', templateIds: [original.id],
            organization: { arrangement: 'manual', groupBy: 'none', sort: 'manual', tags: [], positions: {}, templatePositions: { [original.id]: { x: 15, y: -20 } } },
          },
        ],
        activeCardSet: {
          id: 'legacy-a',
          name: 'Legacy A',
          templateIds: [original.id],
          organization: { arrangement: 'manual', groupBy: 'none', sort: 'manual', tags: [], positions: {}, templatePositions: { [original.id]: { x: -5, y: 7 } } },
        },
        storedCards: [
          { uniqueId: 'legacy-card-a', setId: 'legacy-a', templateId: original.id, data: { title: 'A' } },
          { uniqueId: 'legacy-card-b', setId: 'legacy-b', templateId: original.id, data: { title: 'B' } },
        ],
        appearanceStyles: [],
      },
    }));

    await hydrateProjectWorkspaceForScope(migrationScope);
    const persisted = JSON.parse(parseBrowserWorkspaceRecord((await savedStorage.getItem('workspace'))!).value) as {
      version: number;
      state: {
        userTemplates: Array<{ id: string; templateSource: string }>;
        storedCards: Array<{ uniqueId: string; templateId: string }>;
        cardSets: Array<{ id: string; organization?: { templatePositions?: Record<string, { x: number; y: number }> } }>;
      };
    };
    expect(persisted.version).toBe(9);
    expect(persisted.state.userTemplates.find((template) => template.id === original.id)).toMatchObject(original);
    const mappedIds = persisted.state.storedCards.map((card) => card.templateId);
    expect(mappedIds[0]).not.toBe(original.id);
    expect(mappedIds[1]).not.toBe(original.id);
    expect(mappedIds[0]).not.toBe(mappedIds[1]);
    expect(persisted.state.cardSets.find((set) => set.id === 'legacy-a')?.organization?.templatePositions)
      .toEqual({ [mappedIds[0]!]: { x: -5, y: 7 } });
    expect(persisted.state.cardSets.find((set) => set.id === 'legacy-b')?.organization?.templatePositions)
      .toEqual({ [mappedIds[1]!]: { x: 15, y: -20 } });

    await hydrateProjectWorkspaceForScope(`account:template-migration-away-${ordinal}`);
    await hydrateProjectWorkspaceForScope(migrationScope);
    expect(useProjectStore.getState().storedCards.filter((card) => card.uniqueId.startsWith('legacy-card-')).map((card) => card.templateId))
      .toEqual(mappedIds);
    expect(useProjectStore.getState().userTemplates.find((template) => template.id === original.id)?.templateSource).toBe('default');
  });

  it('migrates version-8 workspaces without inventing Template placement', async () => {
    const migrationScope = `account:template-placement-migration-${ordinal}` as const;
    const savedStorage = createBrowserKeyValueStorage(`project-workspace:${migrationScope}`);
    const set = {
      id: 'placement-migration-set',
      name: 'Placement migration Set',
      organization: {
        arrangement: 'manual',
        groupBy: 'none',
        sort: 'manual',
        tags: [],
        positions: { 'legacy-card': { x: -12, y: 30 } },
      },
    };
    await savedStorage.setItem('workspace', JSON.stringify({
      version: 8,
      state: {
        userTemplates: [],
        cardSets: [set],
        activeCardSet: structuredClone(set),
        storedCards: [],
        appearanceStyles: [],
      },
    }));

    await hydrateProjectWorkspaceForScope(migrationScope);
    const persisted = JSON.parse(parseBrowserWorkspaceRecord((await savedStorage.getItem('workspace'))!).value) as {
      version: number;
      state: {
        cardSets: Array<{ organization?: { templatePositions?: unknown } }>;
        activeCardSet?: { organization?: { templatePositions?: unknown } } | null;
      };
    };
    expect(persisted.version).toBe(9);
    expect(persisted.state.cardSets[0]?.organization).not.toHaveProperty('templatePositions');
    expect(persisted.state.activeCardSet?.organization).not.toHaveProperty('templatePositions');
  });

  it('preserves existing Template placement when adopted Set data omits it', async () => {
    const design = placementTemplate();
    const placements = { [design.id!]: { x: -24, y: 16 } };
    const currentSet = { ...owner(), templateIds: [design.id!], organization: placementOrganization(placements) };
    useProjectStore.setState((state) => ({
      cardSets: state.cardSets.map((set) => set.id === currentSet.id ? currentSet : set),
      activeCardSet: currentSet,
      userTemplates: [design],
    }));
    await persistProjectWorkspaceNow();
    const incoming = await captureCardSetProjectDocument(currentSet.id);
    delete incoming.cardSets[0]!.organization!.templatePositions;

    await applyProjectDocumentToWorkspace(incoming, 'adopt');

    expect(owner().organization?.templatePositions).toEqual(placements);
    expect(useProjectStore.getState().activeCardSet?.organization?.templatePositions).toEqual(placements);
  });

  it('refuses conflicting adopted Template placement without changing either revision', async () => {
    const design = placementTemplate();
    const placements = { [design.id!]: { x: -24, y: 16 } };
    const currentSet = { ...owner(), templateIds: [design.id!], organization: placementOrganization(placements) };
    useProjectStore.setState((state) => ({
      cardSets: state.cardSets.map((set) => set.id === currentSet.id ? currentSet : set),
      activeCardSet: currentSet,
      userTemplates: [design],
    }));
    await persistProjectWorkspaceNow();
    const previous = useProjectStore.getState();
    const saved = await storage().getItem('workspace');
    const incoming = await captureCardSetProjectDocument(currentSet.id);
    incoming.cardSets[0]!.organization!.templatePositions![design.id!] = { x: -25, y: 16 };

    await expect(applyProjectDocumentToWorkspace(incoming, 'adopt')).rejects.toThrow(/different Template placement/i);

    expect(useProjectStore.getState()).toBe(previous);
    expect(owner().organization?.templatePositions).toEqual(placements);
    expect(incoming.cardSets[0]!.organization?.templatePositions?.[design.id!]).toEqual({ x: -25, y: 16 });
    expect(await storage().getItem('workspace')).toBe(saved);
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

  it('accepts unchanged context after a provider JSON round trip reorders nested object keys', async () => {
    const plan = { ...original, brief, notes: { first: 1, second: { a: 'A', b: 'B' } } };
    await apply(plan);
    const document = JSON.parse(JSON.stringify(await captureCardSetProjectDocument('context-a')));
    const reverseKeys = (value: unknown): unknown => Array.isArray(value) ? value.map(reverseKeys)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reverseKeys(entry)])) : value;
    const incoming = reverseKeys(document) as ProjectDocumentV1;
    incoming.cardSets[0].name = 'Agent revision';
    await applyProjectDocumentToWorkspace(incoming, 'adopt');
    expect(owner().name).toBe('Agent revision');
    expect(owner().plan).toEqual(plan);
  });

  it('accepts a semantically identical expected plan with reordered keys during native context CAS', async () => {
    const { context, version, ...rest } = original;
    await applyCardSetPlan({ setId: 'context-a', expectedScope: scope, expectedPlan: { context, ...rest, version }, plan: { ...original, context: 'Creator changed notes' } });
    expect(owner().plan?.context).toBe('Creator changed notes');
  });

  it('does not count inherited fields as unchanged authored metadata during native context CAS', async () => {
    const plan = { ...original, metadata: JSON.parse('{"__proto__":{}}') };
    await apply(plan);
    const state = useProjectStore.getState();
    const saved = await storage().getItem('workspace');
    await expect(apply({ ...original, metadata: {}, context: 'Stale draft' }, { ...plan, metadata: {} })).rejects.toThrow(/changed while/i);
    expect(useProjectStore.getState()).toBe(state);
    expect(await storage().getItem('workspace')).toBe(saved);
  });

  it.each([{ value: 2, sequence: ['a', 'b'] }, { sequence: ['a', 'b'] }, { value: 1, sequence: ['b', 'a'] }])('still refuses changed or missing opaque context metadata: %j', async (notes) => {
    const plan = { ...original, notes: { value: 1, sequence: ['a', 'b'] } };
    await apply(plan);
    const incoming = await captureCardSetProjectDocument('context-a');
    incoming.cardSets[0].plan = { ...plan, notes };
    await expect(applyProjectDocumentToWorkspace(incoming, 'adopt')).rejects.toThrow(/different Set context/);
    expect(owner().plan).toEqual(plan);
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

  it('round-trips every native Set context through a separate whole-workspace backup/restore', async () => {
    const captured = await captureCurrentProjectDocument();
    const archive = await encodeCardForgeProjectPackage(await buildCardForgeProjectSnapshot({ document: captured, name: 'Workspace backup' }));
    await hydrateProjectWorkspaceForScope(`account:restore-${ordinal}`);
    await applyProjectDocumentToWorkspace(hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(archive)), 'replace');
    expect(useProjectStore.getState().cardSets.map((set) => ({ id: set.id, plan: set.plan }))).toEqual(captured.cardSets.map((set) => ({ id: set.id, plan: set.plan })));
  });

  it('imports retained signed-out context as an independent account copy before consuming it', async () => {
    const guest = createBrowserKeyValueStorage('project-workspace:guest');
    const guestTemplate = {
      id: 'guest-template',
      name: 'Guest authored design',
      aspectRatio: '63:88',
      templateSource: 'user',
      templateLibrarySource: 'personal',
      templateLineageId: 'guest-template-lineage',
      templateRevision: 4,
      templateRevisionId: 'guest-template-r4',
      templateOriginLineageId: 'starter-lineage',
      templateOriginRevisionId: 'starter-r2',
      freeformCanvas: { width: 630, height: 880, elements: [] },
    };
    await guest.setItem('workspace', JSON.stringify({
      version: 7,
      state: {
        cardSets: [{ id: 'guest-context', name: 'Signed-out work', plan: original, templateIds: [guestTemplate.id] }],
        activeCardSet: { id: 'guest-context', name: 'Signed-out work' },
        storedCards: [{
          uniqueId: 'guest-card',
          templateId: guestTemplate.id,
          backingTemplateId: null,
          setId: 'guest-context',
          setName: 'Signed-out work',
          data: { name: 'Guest card' },
        }],
        userTemplates: [guestTemplate],
        appearanceStyles: [],
      },
    }));
    const imported = await importRetainedGuestWorkspaceAsCopy();
    expect(imported.consumed).toBe(true);
    expect(imported.importedSetId).not.toBe('guest-context');
    expect(useProjectStore.getState().cardSets.find((set) => set.id === imported.importedSetId)?.plan).toEqual(original);
    expect(imported.summary.templateCount).toBe(1);
    expect(useProjectStore.getState().userTemplates).toHaveLength(1);
    const importedTemplate = useProjectStore.getState().userTemplates[0]!;
    expect(importedTemplate.id).not.toBe(guestTemplate.id);
    expect(importedTemplate).toMatchObject({
      templateSource: 'user',
      templateLibrarySource: 'personal',
      templateLineageId: importedTemplate.id,
      templateOriginLineageId: 'guest-template-lineage',
      templateOriginRevisionId: 'guest-template-r4',
    });
    expect(useProjectStore.getState().cardSets.find((set) => set.id === imported.importedSetId)?.templateIds)
      .toEqual([importedTemplate.id]);
    expect(useProjectStore.getState().storedCards).toHaveLength(1);
    expect(useProjectStore.getState().storedCards[0]).toMatchObject({
      uniqueId: expect.not.stringMatching(/^guest-card$/),
      templateId: importedTemplate.id,
      setId: imported.importedSetId,
    });
    expect(owner().plan).toEqual(original);
    expect(await guest.getItem('workspace')).toBeNull();
  });

  it.each([
    { version: 10, plan: original },
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
