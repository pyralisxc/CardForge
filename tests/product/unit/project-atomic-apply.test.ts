import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reconstructMinimalTemplateObject, type CardAssetOption } from '@/domain/templates';
import { applyProjectDocumentToWorkspace, captureCurrentProjectDocument, cleanCurrentWorkspaceCompletedDeletions, rekeyConflictingTemplateSnapshots } from '@/features/project/client/projectWorkspaceDocument';
import { commitSetTemplateUpdateReview, openSetTemplateUpdateReview } from '@/features/project/client/setTemplateUpdateReview';
import { inspectWorkspaceUpdates } from '@/features/project/client/workspaceUpdates';
import { createProjectWorkspaceDraft, hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { createBrowserKeyValueStorage } from '@/features/project/persistence/indexedDbStorage';
import { getScopedProjectStorageNamespace, restoreBrowserWorkspaceRecovery } from '@/features/project/persistence/projectPersistenceScope';
import { parseBrowserWorkspaceRecord } from '@/features/project/persistence/workspaceRevision';
import { buildCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import { CUSTOM_IMAGE_ASSETS_STORAGE_KEY } from '@/features/project/model/projectDocument';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { removeDeviceWorkAfterVerifiedCopy } from '@/features/project/client/workLocationTransfer';
import { executeSetTrash } from '@/features/storage-management/lib/setTrashLifecycle';
import type { AccountLibraryItem } from '@/features/storage-management/model/accountLibrary';

let counter = 0;
let scope: `account:${string}`;
const imageCatalog = (): CardAssetOption[] => [{ id: 'fixture-image', name: 'Fixture', kind: 'image', url: 'https://example.com/fixture.png', tileMode: 'contain', seamless: false, allowedTargets: [] }];
const fixture = () => {
  const project = createProjectScaleFixture(100);
  project.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY] = imageCatalog();
  return project;
};
const prepareDraft = () => {
  const draft = createProjectWorkspaceDraft();
  const set = { id: 'prepared-set', name: 'Prepared Set' };
  draft.setState({ cardSets: [set], activeCardSet: set });
  return {
    draft,
    relatedWrites: [{
      key: `${getScopedProjectStorageNamespace('project-assets', scope)}:${CUSTOM_IMAGE_ASSETS_STORAGE_KEY}`,
      value: JSON.stringify(imageCatalog()),
      expectedValue: null,
    }],
  };
};
const prepareTemplateUpdateReview = () => {
  const current = reconstructMinimalTemplateObject({
    id: 'working-template', name: 'Current design', aspectRatio: '63:88', templateSource: 'user',
    templateLibrarySource: 'personal', templateLineageId: 'working-lineage', templateRevision: 1,
    templateRevisionId: 'working-revision-1', freeformCanvas: { width: 630, height: 880, elements: [] },
  });
  const source = reconstructMinimalTemplateObject({
    id: 'source-template', name: 'Updated design', aspectRatio: '63:88', templateSource: 'user',
    templateLibrarySource: 'personal', templateLineageId: 'working-lineage', templateRevision: 2,
    templateRevisionId: 'source-revision-2', templateParentRevisionId: 'working-revision-1',
    freeformCanvas: { width: 630, height: 880, elements: [] },
  });
  const other = reconstructMinimalTemplateObject({
    id: 'other-template', name: 'Other Set design', aspectRatio: '63:88', templateSource: 'user',
    templateLibrarySource: 'personal', templateLineageId: 'other-lineage', templateRevision: 1,
    templateRevisionId: 'other-revision-1', freeformCanvas: { width: 630, height: 880, elements: [] },
  });
  const set = { id: 'review-set', name: 'Review Set', templateIds: [current.id!] };
  const otherSet = { id: 'other-set', name: 'Other Set', templateIds: [other.id!] };
  useProjectStore.setState({
    cardSets: [set, otherSet], activeCardSet: set, storedCards: [],
    userTemplates: [current, source, other], defaultTemplates: [],
  });
  return { set, current, source, other, otherSet };
};
describe('atomic project apply', () => {
  beforeEach(async () => {
    scope = `account:atomic-import-${++counter}`;
    await hydrateProjectWorkspaceForScope(scope);
    await new Promise((resolve) => setTimeout(resolve, 1));
    await persistProjectWorkspaceNow();
  });
  afterEach(() => vi.restoreAllMocks());

  it('rejects a cancelled shared workspace draft before changing live or durable work', async () => {
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const before = await raw.getItem('workspace');
    const state = useProjectStore.getState();
    const { draft, relatedWrites } = prepareDraft();
    const controller = new AbortController(); controller.abort();
    await expect(draft.commit(relatedWrites, controller.signal)).rejects.toBeDefined();
    expect(useProjectStore.getState()).toBe(state);
    expect(await raw.getItem('workspace')).toBe(before);
  });
  it('rolls back workspace and related writes when the shared draft is cancelled during commit', async () => {
    const controller = new AbortController();
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const before = await raw.getItem('workspace');
    const state = useProjectStore.getState();
    const { draft, relatedWrites } = prepareDraft();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      if (key === `project-workspace:${scope}:workspace`) controller.abort();
      return request;
    });
    await expect(draft.commit(relatedWrites, controller.signal)).rejects.toBeDefined();
    expect(useProjectStore.getState()).toBe(state);
    expect(await raw.getItem('workspace')).toBe(before);
    expect(await createBrowserKeyValueStorage(`project-assets:${scope}`).getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toBeNull();
  });

  it('commits once, and restores workspace and artwork catalogs together', async () => {
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const assets = createBrowserKeyValueStorage(`project-assets:${scope}`);
    const before = (await raw.getItem('workspace'))!;
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    const savedWorkspace = (await raw.getItem('workspace'))!;
    expect(parseBrowserWorkspaceRecord(savedWorkspace).revision).toBe(parseBrowserWorkspaceRecord(before).revision + 1);
    expect(JSON.parse(parseBrowserWorkspaceRecord(savedWorkspace).value).version).toBe(9);
    expect(await raw.getItem('__recovery__:workspace')).toBe(before);
    expect(await assets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toContain('fixture-image');
    await restoreBrowserWorkspaceRecovery('previous');
    expect(parseBrowserWorkspaceRecord((await raw.getItem('workspace'))!).value).toBe(parseBrowserWorkspaceRecord(before).value);
    expect(await assets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toBeNull();
  });

  it('rolls back workspace and related writes when the shared draft commit fails', async () => {
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const assets = createBrowserKeyValueStorage(`project-assets:${scope}`);
    const before = await raw.getItem('workspace');
    const beforeState = useProjectStore.getState();
    const { draft, relatedWrites } = prepareDraft();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (key === `project-workspace:${scope}:workspace`) throw new DOMException('Disk full', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(draft.commit(relatedWrites)).rejects.toThrow('Disk full');
    expect(useProjectStore.getState()).toBe(beforeState);
    expect(await raw.getItem('workspace')).toBe(before);
    expect(await assets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toBeNull();
  });

  it('allows explicit backup replacement of an unreadable artwork catalog while preserving its bytes', async () => {
    const assets = createBrowserKeyValueStorage(`project-assets:${scope}`);
    await assets.setItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY, '{unreadable-artwork');
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const recovery = JSON.parse((await raw.getItem('__recovery_assets__:workspace'))!);
    expect(recovery[`project-assets:${scope}:${CUSTOM_IMAGE_ASSETS_STORAGE_KEY}`]).toBe('{unreadable-artwork');
    expect(await assets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toContain('fixture-image');
  });

  it('rejects a delayed import when the creator edited after opening began', async () => {
    const expectedState = useProjectStore.getState();
    useProjectStore.getState().setExportDpi(150);
    await expect(applyProjectDocumentToWorkspace(fixture(), 'replace', { expectedState })).rejects.toThrow('workspace changed');
    expect(useProjectStore.getState().exportDpi).toBe(150);
    await persistProjectWorkspaceNow();
  });

  it('aborts an in-flight transaction if local editing resumes before it completes', async () => {
    const assets = createBrowserKeyValueStorage(`project-assets:${scope}`);
    const put = IDBObjectStore.prototype.put;
    let edited = false;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      if (!edited && key === `project-workspace:${scope}:workspace`) {
        edited = true;
        useProjectStore.getState().setExportDpi(150);
      }
      return request;
    });
    await expect(applyProjectDocumentToWorkspace(fixture(), 'replace')).rejects.toThrow('workspace changed');
    expect(useProjectStore.getState().exportDpi).toBe(150);
    expect(useProjectStore.getState().storedCards).toHaveLength(0);
    expect(await assets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toBeNull();
    await persistProjectWorkspaceNow();
  });

  it('opens a backup as an independent editable copy without replacing existing Sets', async () => {
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    const original = useProjectStore.getState().cardSets[0]!.id;
    useProjectStore.getState().setExportDpi(150);
    const incoming = fixture();
    incoming.exportSettings.exportDpi = 600;
    const summary = await applyProjectDocumentToWorkspace(incoming, 'copy');
    expect(summary.activeSetId).not.toBe(original);
    expect(useProjectStore.getState().cardSets).toHaveLength(2);
    expect(useProjectStore.getState().storedCards).toHaveLength(200);
    expect(new Set(useProjectStore.getState().storedCards.map((card) => card.uniqueId)).size).toBe(200);
    expect(useProjectStore.getState().exportDpi).toBe(150);
  });

  it('forks identical colliding Template ids during merge and remaps both card faces and prepared references', () => {
    const incoming = fixture();
    const sourceTemplate = {
      ...incoming.userTemplates[0]!,
      templateLineageId: 'incoming-lineage',
      templateRevisionId: 'incoming-r4',
      templateOriginLineageId: 'incoming-origin',
      templateOriginRevisionId: 'incoming-origin-r2',
      templateOriginAncestors: [{ lineageId: 'earlier-origin', revisionId: 'earlier-r1' }],
    };
    incoming.userTemplates[0] = sourceTemplate;
    const sourceId = sourceTemplate.id!;
    const setId = incoming.cardSets[0]!.id;
    incoming.cardSets[0]!.templateIds = [sourceId];
    incoming.cardSets[0]!.organization = {
      arrangement: 'manual',
      groupBy: 'none',
      sort: 'manual',
      tags: [],
      positions: { 'merge-card': { x: 51, y: -9 } },
      templatePositions: { [sourceId]: { x: -11, y: 37 } },
    };
    const review = {
      version: 1 as const, templateId: sourceId, sourceLineageId: 'incoming-lineage',
      sourceRevisionId: 'incoming-r4', sourceFingerprint: 'a'.repeat(64),
      outcome: 'reviewed' as const, decisions: [{ key: 'name', decision: 'keep' as const }],
    };
    incoming.cardSets[0]!.updateReviews = [review];
    incoming.storedCards = [{ ...incoming.storedCards[0]!, uniqueId: 'merge-card', setId, templateId: sourceId, backingTemplateId: sourceId }];
    const localCollision = {
      ...structuredClone(sourceTemplate),
      templateLineageId: 'local-lineage',
      templateRevisionId: 'local-r9',
      templateOriginLineageId: 'local-origin',
      templateOriginRevisionId: 'local-origin-r8',
      templateOriginAncestors: [{ lineageId: 'local-earlier', revisionId: 'local-r7' }],
    };
    const result = rekeyConflictingTemplateSnapshots(incoming, [localCollision], () => 'merge-fork');
    const nextId = result.userTemplates[0]!.id!;

    expect(nextId).toBe('merge-fork');
    expect(nextId).not.toBe(sourceId);
    expect(result.userTemplates[0]).toMatchObject({
      templateLineageId: nextId,
      templateOriginLineageId: 'incoming-lineage',
      templateOriginRevisionId: 'incoming-r4',
      templateOriginAncestors: [
        { lineageId: 'incoming-origin', revisionId: 'incoming-origin-r2' },
        { lineageId: 'earlier-origin', revisionId: 'earlier-r1' },
      ],
    });
    expect(result.cardSets[0]!.templateIds).toEqual([nextId]);
    expect(result.cardSets[0]!.organization?.templatePositions).toEqual({ [nextId]: { x: -11, y: 37 } });
    expect(result.cardSets[0]!.organization?.positions).toEqual({ 'merge-card': { x: 51, y: -9 } });
    expect(result.cardSets[0]!.updateReviews).toEqual([{ ...review, templateId: nextId }]);
    expect(result.storedCards[0]).toMatchObject({ uniqueId: 'merge-card', templateId: nextId, backingTemplateId: nextId });
    expect(incoming.userTemplates[0]!.id).toBe(sourceId);
    expect(incoming.cardSets[0]!.organization?.templatePositions).toEqual({ [sourceId]: { x: -11, y: 37 } });
  });

  it('refuses a missing incoming Template snapshot that aliases same-Set work without changing either copy', async () => {
    const current = fixture();
    current.version = 3;
    const setId = current.cardSets[0]!.id;
    const originalTemplate = current.userTemplates[0]!;
    const front = { ...structuredClone(originalTemplate), id: 'front-local', name: 'Front' };
    const back = { ...structuredClone(originalTemplate), id: 'back-local', name: 'Back' };
    const prepared = { ...structuredClone(originalTemplate), id: 'prepared-local', name: 'Prepared' };
    current.userTemplates = [front, back, prepared];
    current.cardSets = [{ ...current.cardSets[0]!, templateIds: [prepared.id!] }];
    current.storedCards = [{
      ...current.storedCards[0]!,
      uniqueId: 'existing-card',
      templateId: front.id!,
      backingTemplateId: back.id!,
      setId,
    }];
    current.activeCardSetId = setId;
    await applyProjectDocumentToWorkspace(current, 'replace');

    const storage = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const beforeBytes = await storage.getItem('workspace');
    const beforeState = useProjectStore.getState();
    const incoming = structuredClone(current);
    incoming.userTemplates = [];
    incoming.storedCards = [{
      ...incoming.storedCards[0]!,
      uniqueId: 'historical-card',
      data: { cardName: 'Imported historical card' },
    }];
    const originalInput = structuredClone(incoming);

    await expect(applyProjectDocumentToWorkspace(incoming, 'merge')).rejects.toMatchObject({
      name: 'SetTemplateOwnershipError',
      kind: 'conflict',
    });
    expect(useProjectStore.getState()).toBe(beforeState);
    expect(await storage.getItem('workspace')).toBe(beforeBytes);
    expect(incoming).toEqual(originalInput);

    const reviewOnlyReference = structuredClone(incoming);
    reviewOnlyReference.version = 4;
    reviewOnlyReference.cardSets = [{
      id: 'review-provenance-set',
      name: 'Review provenance',
      updateReviews: [{
        version: 1, templateId: 'front-local', sourceLineageId: 'source-lineage',
        sourceRevisionId: 'source-revision', sourceFingerprint: 'b'.repeat(64),
        outcome: 'reviewed', decisions: [{ key: 'name', decision: 'keep' }],
      }],
    }];
    reviewOnlyReference.activeCardSetId = 'review-provenance-set';
    reviewOnlyReference.userTemplates = [];
    reviewOnlyReference.storedCards = [];
    await applyProjectDocumentToWorkspace(reviewOnlyReference, 'merge');
    const withReviewProvenance = useProjectStore.getState();
    const provenanceSet = withReviewProvenance.cardSets.find((set) => set.id === 'review-provenance-set')!;
    expect(provenanceSet.templateIds ?? []).toEqual([]);
    expect(provenanceSet.updateReviews).toEqual([{
      version: 1, templateId: 'front-local', sourceLineageId: 'source-lineage',
      sourceRevisionId: 'source-revision', sourceFingerprint: 'b'.repeat(64),
      outcome: 'reviewed', decisions: [{ key: 'name', decision: 'keep' }],
    }]);
    expect(withReviewProvenance.userTemplates).toEqual(beforeState.userTemplates);
    expect(withReviewProvenance.cardSets.find((set) => set.id === setId)?.templateIds).toEqual(beforeState.cardSets[0]!.templateIds);
    expect(withReviewProvenance.storedCards).toEqual(beforeState.storedCards);

    const deferred = structuredClone(incoming);
    deferred.cardSets[0]!.templateIds = ['unresolved-historical-template'];
    deferred.storedCards[0] = {
      ...deferred.storedCards[0]!,
      templateId: 'unresolved-historical-template',
      backingTemplateId: null,
    };
    await applyProjectDocumentToWorkspace(deferred, 'merge');
    expect(useProjectStore.getState().userTemplates.some((template) => template.id === 'unresolved-historical-template')).toBe(false);
    expect(useProjectStore.getState().cardSets.find((set) => set.id === setId)?.templateIds)
      .toContain('unresolved-historical-template');
    expect(useProjectStore.getState().storedCards.find((card) => card.uniqueId === 'historical-card')?.templateId)
      .toBe('unresolved-historical-template');
  });

  it('does not report a pre-existing Template or Set as the active context of a standalone import', async () => {
    const existing = fixture();
    existing.cardSets = [];
    existing.storedCards = [];
    existing.activeCardSetId = undefined;
    existing.userTemplates = [{ ...existing.userTemplates[0]!, id: 'template-a', name: 'Existing A' }];
    await applyProjectDocumentToWorkspace(existing, 'replace');
    expect(useProjectStore.getState().generatorSelectedTemplateId).toBe('template-a');

    const incoming = {
      ...existing,
      userTemplates: [{ ...existing.userTemplates[0]!, id: 'template-b', name: 'Incoming B' }],
    };
    const summary = await applyProjectDocumentToWorkspace(incoming, 'merge');
    expect(summary.activeSetId).toBeNull();
    expect(summary.activeTemplateId).toBeNull();
    expect(summary.installedTemplateIds).toEqual(['template-b']);
    const selectedByHandoff = summary.activeTemplateId
      ?? summary.installedTemplateIds.find((id) => useProjectStore.getState().userTemplates.some((template) => template.id === id));
    expect(selectedByHandoff).toBe('template-b');
    expect(useProjectStore.getState().generatorSelectedTemplateId).toBe('template-a');
  });

  it('preserves default Template roles during document installation and refuses complete saves', async () => {
    const incoming = fixture();
    incoming.version = 3;
    const source = { ...incoming.userTemplates[0]!, id: 'default-source', templateSource: 'default' as const };
    incoming.userTemplates = [source];
    incoming.cardSets = [{ id: 'deferred-set', name: 'Deferred', templateIds: [source.id!, 'missing-template'] }];
    incoming.activeCardSetId = 'deferred-set';
    incoming.storedCards = [];

    const summary = await applyProjectDocumentToWorkspace(incoming, 'replace');
    const state = useProjectStore.getState();
    expect(summary.importedTemplateCount).toBe(1);
    expect(summary.installedTemplateIds).toEqual(['default-source']);
    expect(state.userTemplates.find((template) => template.id === 'default-source')?.templateSource).toBe('default');
    expect(state.userTemplates.some((template) => template.id === 'missing-template')).toBe(false);
    expect(state.cardSets[0]?.templateIds).toEqual(['default-source', 'missing-template']);
    await expect(buildCardForgeProjectSnapshot({ document: await captureCurrentProjectDocument(), name: 'Incomplete' }))
      .rejects.toThrow(/working snapshot|Template/i);
  });

  it('refuses a card id imported into a different Set without changing live work', async () => {
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    const before = useProjectStore.getState();
    const incoming = fixture();
    const first = incoming.storedCards[0]!;
    incoming.cardSets = [{ id: 'other-set', name: 'Other Set', templateIds: [first.templateId] }];
    incoming.activeCardSetId = 'other-set';
    incoming.storedCards = [{ ...first, setId: 'other-set' }];

    await expect(applyProjectDocumentToWorkspace(incoming, 'merge')).rejects.toThrow(/different Set.*independent copy/i);
    expect(useProjectStore.getState()).toBe(before);
  });

  it('refuses conflicting same-id asset rows during merge without changing the workspace', async () => {
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    const before = useProjectStore.getState();
    const incoming = fixture();
    incoming.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY] = [{
      ...imageCatalog()[0]!,
      name: 'Different resource',
      url: 'https://example.com/different.png',
    }];

    await expect(applyProjectDocumentToWorkspace(incoming, 'merge')).rejects.toThrow(/independent copy/i);
    expect(useProjectStore.getState()).toBe(before);
  });

  it('adopts an agent revision in place, removes deleted cards, and preserves output preferences', async () => {
    const initial = fixture();
    initial.version = 4;
    const review = {
      version: 1 as const, templateId: initial.userTemplates[0]!.id!, sourceLineageId: 'source-lineage',
      sourceRevisionId: 'source-revision', sourceFingerprint: 'e'.repeat(64), outcome: 'reviewed' as const,
      decisions: [{ key: 'name', decision: 'keep' as const }],
    };
    initial.cardSets[0] = { ...initial.cardSets[0]!, updateReviews: [review] };
    await applyProjectDocumentToWorkspace(initial, 'replace');
    const setId = useProjectStore.getState().cardSets[0]!.id;
    const templateId = useProjectStore.getState().userTemplates[0]!.id!;
    const firstCardId = useProjectStore.getState().storedCards.find((card) => card.setId === setId)!.uniqueId;
    useProjectStore.getState().setExportDpi(150);
    await persistProjectWorkspaceNow();
    const expectedState = useProjectStore.getState();

    const revision = structuredClone(initial);
    revision.cardSets = revision.cardSets.map((set) => set.id === setId ? { ...set, name: 'Agent revision' } : set);
    revision.activeCardSetId = setId;
    revision.userTemplates = revision.userTemplates.map((template) => template.id === templateId
      ? { ...template, name: 'Updated Template' }
      : template);
    revision.storedCards = revision.storedCards.filter((card) => card.uniqueId === firstCardId);
    revision.exportSettings.exportDpi = 600;

    await applyProjectDocumentToWorkspace(revision, 'adopt', { expectedState });

    const current = useProjectStore.getState();
    expect(current.cardSets.find((set) => set.id === setId)?.name).toBe('Agent revision');
    expect(current.userTemplates.find((template) => template.id === templateId)?.name).toBe('Updated Template');
    expect(current.storedCards.filter((card) => card.setId === setId).map((card) => card.uniqueId)).toEqual([firstCardId]);
    expect(current.exportDpi).toBe(150);
    expect(current.cardSets.find((set) => set.id === setId)?.updateReviews).toEqual([review]);
  });

  it('refuses an agent revision with a different Set Update Review ledger atomically', async () => {
    const initial = fixture();
    initial.version = 4;
    const review = {
      version: 1 as const, templateId: initial.userTemplates[0]!.id!, sourceLineageId: 'source-lineage',
      sourceRevisionId: 'source-revision', sourceFingerprint: 'f'.repeat(64), outcome: 'reviewed' as const,
      decisions: [{ key: 'name', decision: 'keep' as const }],
    };
    initial.cardSets[0] = { ...initial.cardSets[0]!, updateReviews: [review] };
    await applyProjectDocumentToWorkspace(initial, 'replace');
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const beforeBytes = await raw.getItem('workspace');
    const beforeState = useProjectStore.getState();
    const revision = structuredClone(initial);
    revision.cardSets[0]!.updateReviews = [{ ...review, sourceFingerprint: 'a'.repeat(64) }];

    await expect(applyProjectDocumentToWorkspace(revision, 'adopt', { expectedState: beforeState }))
      .rejects.toThrow(/different Set Update Review records/);
    expect(useProjectStore.getState()).toBe(beforeState);
    expect(await raw.getItem('workspace')).toBe(beforeBytes);
  });

  it('preserves the existing review ledger when merging an older Set snapshot without one', async () => {
    const initial = fixture();
    initial.version = 4;
    const review = {
      version: 1 as const, templateId: initial.userTemplates[0]!.id!, sourceLineageId: 'source-lineage',
      sourceRevisionId: 'source-revision', sourceFingerprint: '9'.repeat(64), outcome: 'reviewed' as const,
      decisions: [{ key: 'name', decision: 'keep' as const }],
    };
    initial.cardSets[0] = { ...initial.cardSets[0]!, updateReviews: [review] };
    await applyProjectDocumentToWorkspace(initial, 'replace');
    const setId = useProjectStore.getState().cardSets[0]!.id;
    const older = fixture();
    older.version = 3;
    older.cardSets = [{ id: setId, name: 'Older import' }];
    older.userTemplates = [];
    older.storedCards = [];

    await applyProjectDocumentToWorkspace(older, 'merge');

    expect(useProjectStore.getState().cardSets.find((set) => set.id === setId)?.updateReviews).toEqual([review]);
    const preserved = useProjectStore.getState();
    expect(() => preserved.mergeCardSetsFromFiles([{
      id: setId, name: 'Conflicting import', updateReviews: [{ ...review, sourceFingerprint: '0'.repeat(64) }],
    }])).toThrow(/conflicting Update Review record/i);
    expect(useProjectStore.getState()).toBe(preserved);
  });

  it('commits accepted Template content and its review ledger under one native revision parent', async () => {
    const { set, current, source, other, otherSet } = prepareTemplateUpdateReview();
    await persistProjectWorkspaceNow();
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const beforeBytes = (await raw.getItem('workspace'))!;
    const beforeRevision = parseBrowserWorkspaceRecord(beforeBytes).revision;
    const comparison = await openSetTemplateUpdateReview(set.id, current.id!, source.id!);
    const choices = Object.fromEntries(comparison.changes.map((change) => [change.key, 'use' as const]));

    await commitSetTemplateUpdateReview(comparison, choices);

    const after = useProjectStore.getState();
    const updated = after.userTemplates.find((template) => template.id === current.id)!;
    expect(updated).toMatchObject({
      name: source.name, templateLineageId: current.templateLineageId,
      templateParentRevisionId: current.templateRevisionId, templateRevision: 2,
    });
    expect(updated.templateRevisionId).not.toBe(current.templateRevisionId);
    expect(after.userTemplates.find((template) => template.id === source.id)).toEqual(source);
    expect(after.userTemplates.find((template) => template.id === other.id)).toEqual(other);
    expect(after.cardSets.find((candidate) => candidate.id === otherSet.id)).toEqual(otherSet);
    expect(after.cardSets.find((candidate) => candidate.id === set.id)?.updateReviews).toMatchObject([{
      templateId: current.id, sourceLineageId: source.templateLineageId,
      sourceRevisionId: source.templateRevisionId, outcome: 'reviewed',
    }]);
    expect(parseBrowserWorkspaceRecord((await raw.getItem('workspace'))!).revision).toBe(beforeRevision + 1);
    const recorded = after.cardSets.find((candidate) => candidate.id === set.id)?.updateReviews;
    const reopened = await openSetTemplateUpdateReview(set.id, current.id!, source.id!);
    expect(reopened.changes).toEqual([]);
    await commitSetTemplateUpdateReview(reopened, reopened.initialChoices);
    expect(useProjectStore.getState().cardSets.find((candidate) => candidate.id === set.id)?.updateReviews).toEqual(recorded);
  });

  it('rechecks a published source before applying without installing a second source snapshot', async () => {
    const { set, current, source, other } = prepareTemplateUpdateReview();
    useProjectStore.setState({ userTemplates: [current, other] });
    await persistProjectWorkspaceNow();
    const readSource = vi.fn(async () => source);
    const before = await captureCurrentProjectDocument();
    const available = await inspectWorkspaceUpdates(useProjectStore.getState(), [source]);
    expect(available.find((item) => item.set.id === set.id)).toMatchObject({ pending: 1, items: [{ origin: 'published', reviewed: false }] });
    const comparison = await openSetTemplateUpdateReview(set.id, current.id!, source.id!, undefined, readSource);
    const choices = Object.fromEntries(comparison.changes.map((change) => [change.key, 'keep' as const]));
    readSource.mockRejectedValueOnce(new Error('Source access not permitted'));
    await expect(commitSetTemplateUpdateReview(comparison, choices)).rejects.toThrow('Source access not permitted');
    expect(await captureCurrentProjectDocument()).toEqual(before);
    readSource.mockResolvedValueOnce({ ...source, name: 'Changed after opening' });
    await expect(commitSetTemplateUpdateReview(comparison, choices)).rejects.toThrow(/changed|stale/i);
    expect(await captureCurrentProjectDocument()).toEqual(before);
    await commitSetTemplateUpdateReview(comparison, choices);
    expect(readSource).toHaveBeenCalledTimes(4);
    expect(useProjectStore.getState().userTemplates).toEqual([current, other]);
    const completed = await inspectWorkspaceUpdates(useProjectStore.getState(), [source]);
    expect(completed.find((item) => item.set.id === set.id)?.pending).toBe(0);
    const changed = await inspectWorkspaceUpdates(useProjectStore.getState(), [{ ...source, name: 'Another source change' }]);
    expect(changed.find((item) => item.set.id === set.id)?.pending).toBe(1);
    expect(changed.find((item) => item.set.id === set.id)?.items[0].key).not.toBe(available.find((item) => item.set.id === set.id)?.items[0].key);
  });

  it('restores deferred source-unavailable work without inventing a source snapshot', async () => {
    const { set, current, source, other } = prepareTemplateUpdateReview();
    await persistProjectWorkspaceNow();
    const comparison = await openSetTemplateUpdateReview(set.id, current.id!, source.id!);
    await commitSetTemplateUpdateReview(comparison, {});
    const available = await inspectWorkspaceUpdates(useProjectStore.getState(), []);
    useProjectStore.setState({ userTemplates: [current, other] });
    const unavailable = await inspectWorkspaceUpdates(useProjectStore.getState(), []);
    const first = available.find((item) => item.set.id === set.id)!;
    const deferred = unavailable.find((item) => item.set.id === set.id)!;
    expect(deferred.pending).toBe(1);
    expect(deferred.items).toEqual([]);
    expect(deferred.unavailable[0].key).toBe(first.items[0].key);
    const controller = new AbortController();
    controller.abort();
    await expect(inspectWorkspaceUpdates(useProjectStore.getState(), [source], controller.signal)).rejects.toBeDefined();
  });

  it('discards a published source read that finishes after an account switch', async () => {
    const { set, current, source } = prepareTemplateUpdateReview();
    let release!: (value: typeof source) => void;
    const reading = new Promise<typeof source>((resolve) => { release = resolve; });
    const opening = openSetTemplateUpdateReview(set.id, current.id!, source.id!, undefined, () => reading);
    await hydrateProjectWorkspaceForScope('account:source-check-other-account');
    const otherAccount = await captureCurrentProjectDocument();
    release(source);
    await expect(opening).rejects.toThrow(/active account changed/i);
    expect(await captureCurrentProjectDocument()).toEqual(otherAccount);
  });

  it('refuses a stale all-keep review after ledger-only work, then permits a reopened review', async () => {
    const { set, current, source } = prepareTemplateUpdateReview();
    await persistProjectWorkspaceNow();
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const originalRevision = current.templateRevisionId;
    const comparison = await openSetTemplateUpdateReview(set.id, current.id!, source.id!);
    const keepChoices = Object.fromEntries(comparison.changes.map((change) => [change.key, 'keep' as const]));
    const deferChoices = Object.fromEntries(comparison.changes.map((change) => [change.key, 'defer' as const]));

    await expect(commitSetTemplateUpdateReview(comparison, keepChoices)).resolves.toMatchObject({
      outcome: 'reviewed', changesTemplate: false,
    });
    const reviewedState = useProjectStore.getState();
    const reviewedBytes = await raw.getItem('workspace');
    expect(reviewedState.userTemplates.find((template) => template.id === current.id)?.templateRevisionId).toBe(originalRevision);
    expect(reviewedState.cardSets.find((candidate) => candidate.id === set.id)?.updateReviews).toMatchObject([{
      templateId: current.id, sourceLineageId: source.templateLineageId,
      sourceRevisionId: source.templateRevisionId, outcome: 'reviewed',
    }]);

    await expect(commitSetTemplateUpdateReview(comparison, deferChoices)).rejects.toThrow(/review record changed/i);
    expect(useProjectStore.getState()).toBe(reviewedState);
    expect(await raw.getItem('workspace')).toBe(reviewedBytes);

    const reopened = await openSetTemplateUpdateReview(set.id, current.id!, source.id!);
    expect(reopened.expectedReview).toMatchObject({ outcome: 'reviewed' });
    expect(reopened.initialChoices).toEqual(keepChoices);
    await expect(commitSetTemplateUpdateReview(reopened, deferChoices)).resolves.toMatchObject({
      outcome: 'deferred', changesTemplate: false,
    });
    expect(useProjectStore.getState().userTemplates.find((template) => template.id === current.id)?.templateRevisionId).toBe(originalRevision);
    expect(useProjectStore.getState().cardSets.find((candidate) => candidate.id === set.id)?.updateReviews).toMatchObject([{
      templateId: current.id, sourceLineageId: source.templateLineageId,
      sourceRevisionId: source.templateRevisionId, outcome: 'deferred',
    }]);
  });

  it('keeps review content and ledger unchanged when the atomic browser commit is cancelled or fails', async () => {
    const { set, current, source } = prepareTemplateUpdateReview();
    await persistProjectWorkspaceNow();
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const beforeBytes = await raw.getItem('workspace');
    const beforeState = useProjectStore.getState();
    const comparison = await openSetTemplateUpdateReview(set.id, current.id!, source.id!);
    const choices = Object.fromEntries(comparison.changes.map((change) => [change.key, 'use' as const]));
    const controller = new AbortController();
    controller.abort();
    await expect(commitSetTemplateUpdateReview(comparison, choices, controller.signal)).rejects.toBeDefined();
    expect(useProjectStore.getState()).toBe(beforeState);
    expect(await raw.getItem('workspace')).toBe(beforeBytes);

    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (key === `project-workspace:${scope}:workspace`) throw new DOMException('Disk full', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(commitSetTemplateUpdateReview(comparison, choices)).rejects.toThrow('Disk full');
    expect(useProjectStore.getState()).toBe(beforeState);
    expect(await raw.getItem('workspace')).toBe(beforeBytes);
  });

  it('keeps device edits made while a destination copy was being uploaded', async () => {
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    const expectedState = useProjectStore.getState();
    const setId = expectedState.cardSets[0]!.id;
    useProjectStore.getState().renameCardSet(setId, 'Edited during upload');
    await expect(removeDeviceWorkAfterVerifiedCopy({ setId, expectedState, scope })).rejects.toThrow('workspace changed');
    expect(useProjectStore.getState().cardSets[0]!.name).toBe('Edited during upload');
    await persistProjectWorkspaceNow();
  });

  it('commits verified device removal once and keeps the source as recovery', async () => {
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    const expectedState = useProjectStore.getState();
    const setId = expectedState.cardSets[0]!.id;
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const source = await raw.getItem('workspace');
    await removeDeviceWorkAfterVerifiedCopy({ setId, expectedState, scope });
    expect(useProjectStore.getState().cardSets.some((set) => set.id === setId)).toBe(false);
    expect(await raw.getItem('__recovery__:workspace')).toBe(source);
  });

  it('retains the device Set when committing Trash fails', async () => {
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    await persistProjectWorkspaceNow();
    const beforeState = useProjectStore.getState();
    const setId = beforeState.cardSets[0]!.id;
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const beforeBytes = await raw.getItem('workspace');
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (key === `project-workspace:${scope}:workspace`) throw new DOMException('Disk full', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    const item = { references: { localSetId: setId } } as AccountLibraryItem;
    await expect(executeSetTrash({ item, target: 'device', canUseDrive: false, scope })).resolves.toEqual({ kind: 'needs-attention', message: 'Disk full' });
    expect(useProjectStore.getState()).toBe(beforeState);
    expect(await raw.getItem('workspace')).toBe(beforeBytes);
  });
});

it('preserves newer work when confirmed deletion evidence arrives after an edit', async () => {
  await hydrateProjectWorkspaceForScope('account:cleanup-race');
  await new Promise((resolve) => setTimeout(resolve, 1));
  await persistProjectWorkspaceNow();
  let release!: (value: Response) => void;
  const response = new Promise<Response>((resolve) => { release = resolve; });
  const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(response);
  try {
    const incoming = fixture();
    const applying = applyProjectDocumentToWorkspace(incoming, 'replace');
    useProjectStore.getState().setExportDpi(150);
    release(new Response(JSON.stringify({ deletedUrls: ['https://example.com/fixture.png'] })));
    await expect(applying).rejects.toThrow('workspace changed');
    expect(useProjectStore.getState().exportDpi).toBe(150);
    expect(useProjectStore.getState().storedCards).toHaveLength(0);
    await persistProjectWorkspaceNow();
  } finally { fetch.mockRestore(); }
});


it('rejects cleanup after a concurrent artwork catalog edit outside Zustand', async () => {
  const scope = 'account:cleanup-catalog-race';
  await hydrateProjectWorkspaceForScope(scope);
  await new Promise((resolve) => setTimeout(resolve, 1));
  await applyProjectDocumentToWorkspace(fixture(), 'replace');
  const assets = createBrowserKeyValueStorage(`project-assets:${scope}`);
  let release!: (value: Response) => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => { started = resolve; });
  const response = new Promise<Response>((resolve) => { release = resolve; });
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { started(); return response; });
  try {
    const cleaning = cleanCurrentWorkspaceCompletedDeletions();
    await pending;
    const updated = JSON.stringify([{ id: 'new-art', name: 'New artwork', url: 'https://example.com/new.png' }]);
    await assets.setItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY, updated);
    release(new Response(JSON.stringify({ deletedUrls: ['https://example.com/fixture.png'] })));
    await expect(cleaning).rejects.toThrow();
    expect(await assets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toBe(updated);
    expect(useProjectStore.getState().storedCards).toHaveLength(100);
  } finally { fetch.mockRestore(); }
});
