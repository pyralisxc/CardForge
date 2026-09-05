import { describe, expect, it, vi } from 'vitest';
import type { CardAssetOption } from '@/domain/templates';
import type { ProjectFontAsset } from '@/features/project/client/assets';
import { projectLocalLibraryAsset, projectLocalLibraryFont, retainLocalLibraryResources, getLocalLibrarySelectionValue } from '@/features/project/model/localLibraryResources';
import { readLocalLibraryResources } from '@/features/project/client/library-resources';
import { toLocalLibraryPickerResources } from '@/features/library-picker/client';
import { CUSTOM_IMAGE_ASSETS_STORAGE_KEY } from '@/features/project/client/package-document';

import {
  buildAccountLibraryItems,
  getAccountLibraryAvailableActions,
  getAccountLibraryMcpWorkflow,
  resolveAccountHomeLibraryProjection,
} from '@/features/storage-management/model/accountLibrary';
import {
  getAccountLibraryActionSources,
  getAccountLibraryEnvironmentActions,
} from '@/features/storage-management/model/accountLibraryEnvironment';

describe('account library model', () => {
  const localAsset = (overrides: Partial<CardAssetOption> = {}): CardAssetOption => ({
    id: 'native-image-id', name: 'My artwork', url: `cardforge-browser-asset://${'a'.repeat(64)}`,
    kind: 'image', tileMode: 'contain', seamless: false, allowedTargets: ['image'], ...overrides,
  });

  it('projects native local resources without synthetic binary estimates or destructive actions', () => {
    const image = projectLocalLibraryAsset('image', localAsset());
    const [item] = buildAccountLibraryItems({ localSets: [], localResources: [image], driveProjects: [], driveBindingFileId: null, localWorkFolders: [], personalAssets: [], workingDrafts: [] });
    expect(item?.localResource?.objectId).toBe('native-image-id');
    expect(item?.sizeBytes).toBeNull();
    expect(item?.locations).toEqual([{ source: 'device', status: 'available', label: 'This device' }]);
    expect(getAccountLibraryAvailableActions(item!)).toEqual([]);
    expect(getAccountLibraryMcpWorkflow(item!).availability).toBe('browser-only');
    expect(getLocalLibrarySelectionValue([image], image.id)).toBe(localAsset().url);
  });

  it('preserves distinct collection identities and font assignment values in the shared picker', () => {
    const image = projectLocalLibraryAsset('image', localAsset());
    const icon = projectLocalLibraryAsset('icon', localAsset({ kind: 'icon' }));
    const font = projectLocalLibraryFont({ id: 'native-image-id', name: 'My font', value: 'font-personal-original', mimeType: 'font/woff2', dataUrl: 'data:font/woff2;base64,AQID', fileSizeBytes: 3 });
    const resources = [image, icon, font];
    const options = toLocalLibraryPickerResources(resources);
    expect(new Set(options.map((option) => option.id)).size).toBe(3);
    expect(options.map((option) => option.objectId)).toEqual(['native-image-id', 'native-image-id', 'native-image-id']);
    expect(options.every((option) => option.source === 'project' && option.materialization === 'already-local')).toBe(true);
    expect(getLocalLibrarySelectionValue(resources, font.id)).toBe('font-personal-original');
    expect(font.sizeBytes).toBe(3);
    const frame = projectLocalLibraryAsset('image', localAsset({ kind: 'frame' }));
    expect(toLocalLibraryPickerResources([frame])[0]).toMatchObject({ kind: 'image', role: 'frame' });
  });

  it('shows missing and unavailable sources without offering them for selection', () => {
    const missing = projectLocalLibraryAsset('image', localAsset({ url: '' }));
    expect(missing.status).toBe('missing-source');
    const retained = retainLocalLibraryResources([projectLocalLibraryAsset('icon', localAsset({ kind: 'icon' }))], [missing], ['icon']);
    expect(retained[1]?.status).toBe('unavailable');
    expect(toLocalLibraryPickerResources(retained)).toEqual([]);
    expect(() => getLocalLibrarySelectionValue(retained, missing.id)).toThrow('unavailable');
    expect(() => getLocalLibrarySelectionValue(retained, 'deleted')).toThrow('unavailable');
  });

  it('keeps readable collections when a native resource collection fails', async () => {
    const readAssets = vi.fn(async (key: string) => {
      if (key === CUSTOM_IMAGE_ASSETS_STORAGE_KEY) throw new Error('Artwork metadata could not be read');
      return [localAsset()];
    });
    const readFonts = vi.fn(async (): Promise<ProjectFontAsset[]> => []);
    const result = await readLocalLibraryResources({ readAssets, readFonts });
    expect(readAssets).toHaveBeenCalledTimes(4);
    expect(readFonts).toHaveBeenCalledOnce();
    expect(result.resources).toHaveLength(3);
    expect(result.failures).toEqual([{ collection: 'image', error: expect.any(Error) }]);
  });

  it('reports font collection read failure while preserving readable artwork', async () => {
    const result = await readLocalLibraryResources({
      readAssets: async () => [localAsset()],
      readFonts: async () => { throw new Error('Unreadable font record'); },
    });
    expect(result.resources).toHaveLength(4);
    expect(result.failures[0]?.collection).toBe('font');
  });

  it('shows browser Sets as device-owned work', () => {
    const items = buildAccountLibraryItems({
      localSets: [{ id: 'set-1', name: 'Arcane Deck', cardCount: 52, sizeBytes: 1200 }],
      driveProjects: [],
      driveBindingFileId: null,
      localWorkFolders: [],
      personalAssets: [],
      workingDrafts: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'set',
      name: 'Arcane Deck',
      locations: [{ source: 'device', status: 'available' }],
      references: { localSetId: 'set-1' },
    });
  });

  it('shows personal Templates as rendered reusable Library objects', () => {
    const [template] = buildAccountLibraryItems({
      localSets: [],
      localTemplates: [{ id: 'template-1', name: 'Arcane Frame' }],
      driveProjects: [],
      driveBindingFileId: null,
      localWorkFolders: [],
      personalAssets: [],
      workingDrafts: [],
    });

    expect(template).toMatchObject({
      kind: 'template',
      name: 'Arcane Frame',
      locations: [{ source: 'device', status: 'available' }],
      references: { localTemplateId: 'template-1' },
    });
    expect(getAccountLibraryAvailableActions(template!)).toEqual(['open', 'duplicate']);
    expect(getAccountLibraryEnvironmentActions(template!).map((action) => action.ownerFeature)).toEqual(['template-editor', 'card-generator']);
  });

  it('keeps provider-owned projects, assets, folders, and temporary drafts explicit', () => {
    const items = buildAccountLibraryItems({
      localSets: [],
      driveProjects: [{
        fileId: 'drive-project-1',
        name: 'Campaign.cardforge',
        providerRevision: '7',
        projectRevision: 'project-revision',
        modifiedAt: '2026-08-24T11:00:00.000Z',
        size: 2400,
        webViewLink: 'https://drive.google.com/file/d/drive-project-1/view',
      }],
      driveBindingFileId: 'drive-project-1',
      localWorkFolders: [{
        workId: 'missing-local-work',
        folderName: 'Local Campaign',
        sourceRevision: 'local-revision',
        lastSavedAt: '2026-08-24T10:00:00.000Z',
        permission: 'prompt',
      }],
      personalAssets: [{
        id: 'asset-1',
        displayName: 'Frame.png',
        roleLabel: 'Frames',
        byteSize: 900,
        providerRevision: '3',
        providerModifiedAt: '2026-08-24T09:00:00.000Z',
        providerWebViewLink: null,
      }],
      workingDrafts: [{
        id: 'draft-1',
        title: 'Assistant concept',
        revision: 2,
        creationSource: 'gpt',
        updatedAt: '2026-08-24T08:00:00.000Z',
        expiresAt: '2026-08-25T08:00:00.000Z',
      }],
    });

    expect(items.map((item) => item.kind)).toEqual(['set', 'asset', 'working-draft']);
    expect(items[0]?.locations[0]).toMatchObject({ source: 'google-drive', status: 'attached' });
    expect(items[1]?.locations[0]).toMatchObject({ source: 'google-drive', status: 'available' });
    expect(items[2]?.locations[0]).toMatchObject({ source: 'assistant-draft', status: 'temporary' });
  });

  it('keeps browser actions complete while matching the MCP lifecycle for reachable sources', () => {
    const items = buildAccountLibraryItems({
      localSets: [{ id: 'local-set', name: 'Local Set', cardCount: 12, sizeBytes: 1200 }],
      driveProjects: [{
        fileId: 'drive-project',
        name: 'Connected.cardforge',
        providerRevision: '7',
        projectRevision: 'project-revision',
        modifiedAt: '2026-08-24T11:00:00.000Z',
        size: 2400,
        webViewLink: 'https://drive.google.com/file/d/drive-project/view',
      }],
      driveBindingFileId: null,
      localWorkFolders: [],
      personalAssets: [],
      workingDrafts: [{
        id: 'draft',
        title: 'Assistant draft',
        revision: 4,
        creationSource: 'gpt',
        updatedAt: '2026-08-24T10:00:00.000Z',
        expiresAt: '2026-08-25T10:00:00.000Z',
      }],
    });
    const localSet = items.find((item) => item.references.localSetId === 'local-set');
    const connectedProject = items.find((item) => item.references.driveFileId === 'drive-project');
    const draft = items.find((item) => item.references.workingDraftId === 'draft');

    expect(getAccountLibraryAvailableActions(localSet!)).toEqual(['open', 'save-move', 'duplicate', 'delete-copy']);
    expect(getAccountLibraryMcpWorkflow(localSet!)).toEqual({ availability: 'browser-only', tools: [] });

    expect(getAccountLibraryAvailableActions(connectedProject!)).toEqual(['open', 'save-move', 'delete-copy', 'view-source', 'manage-storage']);
    expect(getAccountLibraryMcpWorkflow(connectedProject!)).toMatchObject({
      availability: 'revision-safe',
      tools: ['list_connected_projects', 'checkout_project', 'commit_project'],
    });

    expect(getAccountLibraryAvailableActions(draft!)).toEqual(['continue']);
    expect(getAccountLibraryMcpWorkflow(draft!)).toMatchObject({
      availability: 'working-document',
      tools: ['list_agent_working_documents', 'get_agent_install_status'],
    });
  });

  it('uses the active local Set as Home even when a provider item has the newest timestamp', () => {
    const items = buildAccountLibraryItems({
      localSets: [{ id: 'active-set', name: 'Active Set', cardCount: 12, sizeBytes: 1200 }],
      driveProjects: [{
        fileId: 'recent-drive',
        name: 'Newest.cardforge',
        providerRevision: '8',
        projectRevision: 'project-revision',
        modifiedAt: '2026-08-25T11:00:00.000Z',
        size: 2400,
        webViewLink: null,
      }],
      driveBindingFileId: null,
      localWorkFolders: [],
      personalAssets: [],
      workingDrafts: [],
    });

    const home = resolveAccountHomeLibraryProjection(items, 'active-set');
    expect(home.featuredItem?.references.localSetId).toBe('active-set');
    expect(home.moreItems[0]?.references.driveFileId).toBe('recent-drive');
  });

  it('projects provider actions and revisions into the Environment contract', () => {
    const [project, draft] = buildAccountLibraryItems({
      localSets: [],
      driveProjects: [{
        fileId: 'drive-project',
        name: 'Connected.cardforge',
        providerRevision: '7',
        projectRevision: 'project-revision',
        modifiedAt: '2026-08-24T11:00:00.000Z',
        size: 2400,
        webViewLink: 'https://drive.google.com/file/d/drive-project/view',
      }],
      driveBindingFileId: null,
      localWorkFolders: [],
      personalAssets: [],
      workingDrafts: [{
        id: 'draft',
        title: 'Assistant draft',
        revision: 4,
        creationSource: 'gpt',
        updatedAt: '2026-08-24T10:00:00.000Z',
        expiresAt: '2026-08-25T10:00:00.000Z',
      }],
    });

    expect(getAccountLibraryActionSources(project!)).toEqual([{
      id: 'drive-project:drive-project:google-drive:0',
      label: 'Google Drive',
      source: 'google-drive',
      currentRevisionAvailable: true,
    }]);
    expect(getAccountLibraryEnvironmentActions(project!).map((action) => ({
      id: action.id,
      hierarchy: action.hierarchy,
      revisionPolicy: action.revisionPolicy,
      automation: action.automation,
    }))).toEqual([
      {
        id: 'library.open', hierarchy: 'primary', revisionPolicy: 'none',
        automation: { kind: 'published-mcp', tools: ['list_connected_projects', 'checkout_project'] },
      },
      {
        id: 'library.save-move', hierarchy: 'supporting', revisionPolicy: 'none',
        automation: { kind: 'human-only', owner: 'cardforge' },
      },
      {
        id: 'library.view-source', hierarchy: 'supporting', revisionPolicy: 'none',
        automation: { kind: 'human-only', owner: 'provider' },
      },
      {
        id: 'library.manage-location', hierarchy: 'overflow', revisionPolicy: 'none',
        automation: { kind: 'human-only', owner: 'cardforge' },
      },
      {
        id: 'library.delete-copy', hierarchy: 'overflow', revisionPolicy: 'conflict-safe',
        automation: { kind: 'human-only', owner: 'provider' },
      },
    ]);
    expect(getAccountLibraryEnvironmentActions(draft!).map((action) => action.id)).toEqual(['library.continue']);
  });

  it('keeps local work open to guests while requiring an account for provider work', () => {
    const items = buildAccountLibraryItems({
      localSets: [{ id: 'local-set', name: 'Local Set', cardCount: 12, sizeBytes: 1200 }],
      driveProjects: [{ fileId: 'drive-project', name: 'Connected.cardforge', providerRevision: '7', projectRevision: 'project-revision', modifiedAt: '2026-08-24T11:00:00.000Z', size: 2400, webViewLink: null }],
      driveBindingFileId: null,
      localWorkFolders: [],
      personalAssets: [],
      workingDrafts: [],
    });

    const localSet = items.find((item) => item.references.localSetId === 'local-set');
    const driveProject = items.find((item) => item.references.driveFileId === 'drive-project');
    expect(getAccountLibraryEnvironmentActions(localSet!)[0]).toMatchObject({ requiredPermission: 'guest' });
    expect(getAccountLibraryEnvironmentActions(driveProject!)[0]).toMatchObject({ requiredPermission: 'member' });
  });

  it('pools copies of one Set into one Library object with multiple locations', () => {
    const items = buildAccountLibraryItems({
      localSets: [{ id: 'set-1', name: 'Arcane Deck', cardCount: 52, sizeBytes: 1200 }],
      driveProjects: [{
        fileId: 'drive-project', name: 'Arcane Deck.cardforge', providerRevision: '7',
        projectRevision: 'project-revision', modifiedAt: '2026-08-24T11:00:00.000Z', size: 2400,
        webViewLink: null, workId: 'set-1',
      }],
      driveBindingFileId: null,
      localWorkFolders: [{
        workId: 'set-1', folderName: 'Arcane Deck', sourceRevision: 'local-revision',
        lastSavedAt: '2026-08-24T10:00:00.000Z', permission: 'granted',
      }],
      personalAssets: [], workingDrafts: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'set',
      references: { localSetId: 'set-1', driveFileId: 'drive-project', localFolder: true },
    });
    expect(items[0]?.locations.map((location) => location.source)).toEqual(['device', 'google-drive', 'local-folder']);
  });
});
