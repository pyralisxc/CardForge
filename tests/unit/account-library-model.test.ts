import { describe, expect, it } from 'vitest';

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
