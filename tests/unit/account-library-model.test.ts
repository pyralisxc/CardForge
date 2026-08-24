import { describe, expect, it } from 'vitest';

import { buildAccountLibraryItems } from '@/features/storage-management/model/accountLibrary';

describe('account library model', () => {
  it('shows one set with every location instead of duplicating the item by storage provider', () => {
    const items = buildAccountLibraryItems({
      localSets: [{ id: 'set-1', name: 'Arcane Deck', cardCount: 52, sizeBytes: 1200 }],
      cloudSets: [{
        setId: 'set-1',
        name: 'Arcane Deck',
        cardCount: 52,
        revision: 4,
        storageBytes: 4800,
        updatedAt: '2026-08-24T12:00:00.000Z',
      }],
      driveProjects: [],
      driveBindingFileId: null,
      localFolder: null,
      personalAssets: [],
      workingDrafts: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'set',
      name: 'Arcane Deck',
      locations: [
        { source: 'device', status: 'available' },
        { source: 'cardforge-cloud', status: 'available' },
      ],
      references: { localSetId: 'set-1', cloudSetId: 'set-1' },
    });
  });

  it('keeps provider-owned projects, assets, folders, and temporary drafts explicit', () => {
    const items = buildAccountLibraryItems({
      localSets: [],
      cloudSets: [],
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
      localFolder: {
        folderName: 'Local Campaign',
        sourceRevision: 'local-revision',
        lastSavedAt: '2026-08-24T10:00:00.000Z',
        permission: 'prompt',
      },
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

    expect(items.map((item) => item.kind)).toEqual(['project', 'project', 'asset', 'working-draft']);
    expect(items[0]?.locations[0]).toMatchObject({ source: 'google-drive', status: 'attached' });
    expect(items[1]?.locations[0]).toMatchObject({ source: 'local-folder', status: 'needs-permission' });
    expect(items[2]?.locations[0]).toMatchObject({ source: 'google-drive', status: 'available' });
    expect(items[3]?.locations[0]).toMatchObject({ source: 'assistant-draft', status: 'temporary' });
  });
});
