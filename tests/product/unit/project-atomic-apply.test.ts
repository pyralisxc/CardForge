import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyProjectDocumentToWorkspace } from '@/features/project/client/projectWorkspaceDocument';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';
import { createBrowserKeyValueStorage } from '@/features/project/persistence/indexedDbStorage';
import { restoreBrowserWorkspaceRecovery } from '@/features/project/persistence/projectPersistenceScope';
import { parseBrowserWorkspaceRecord } from '@/features/project/persistence/workspaceRevision';
import { CUSTOM_IMAGE_ASSETS_STORAGE_KEY } from '@/features/project/model/projectDocument';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { removeDeviceWorkAfterVerifiedCopy } from '@/features/project/client/workLocationTransfer';

let counter = 0;
let scope: `account:${string}`;
const fixture = () => {
  const project = createProjectScaleFixture(100);
  project.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY] = [{ id: 'fixture-image', name: 'Fixture', kind: 'image', url: 'https://example.com/fixture.png', tileMode: 'contain', seamless: false, allowedTargets: [] }];
  return project;
};
describe('atomic project apply', () => {
  beforeEach(async () => {
    scope = `account:atomic-import-${++counter}`;
    await hydrateProjectWorkspaceForScope(scope);
    await new Promise((resolve) => setTimeout(resolve, 1));
    await persistProjectWorkspaceNow();
  });
  afterEach(() => vi.restoreAllMocks());

  it('commits once, and restores workspace and artwork catalogs together', async () => {
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const assets = createBrowserKeyValueStorage(`project-assets:${scope}`);
    const before = (await raw.getItem('workspace'))!;
    await applyProjectDocumentToWorkspace(fixture(), 'replace');
    expect(parseBrowserWorkspaceRecord((await raw.getItem('workspace'))!).revision).toBe(parseBrowserWorkspaceRecord(before).revision + 1);
    expect(await raw.getItem('__recovery__:workspace')).toBe(before);
    expect(await assets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toContain('fixture-image');
    await restoreBrowserWorkspaceRecovery('previous');
    expect(parseBrowserWorkspaceRecord((await raw.getItem('workspace'))!).value).toBe(parseBrowserWorkspaceRecord(before).value);
    expect(await assets.getItem(CUSTOM_IMAGE_ASSETS_STORAGE_KEY)).toBeNull();
  });

  it('rolls back catalogs and leaves live state unchanged on a failed workspace commit', async () => {
    const raw = createBrowserKeyValueStorage(`project-workspace:${scope}`);
    const assets = createBrowserKeyValueStorage(`project-assets:${scope}`);
    const before = await raw.getItem('workspace');
    const beforeState = useProjectStore.getState();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (key === `project-workspace:${scope}:workspace`) throw new DOMException('Disk full', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(applyProjectDocumentToWorkspace(fixture(), 'replace')).rejects.toThrow('Disk full');
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
    const summary = await applyProjectDocumentToWorkspace(fixture(), 'copy');
    expect(summary.activeSetId).not.toBe(original);
    expect(useProjectStore.getState().cardSets).toHaveLength(2);
    expect(useProjectStore.getState().storedCards).toHaveLength(200);
    expect(new Set(useProjectStore.getState().storedCards.map((card) => card.uniqueId)).size).toBe(200);
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
});
