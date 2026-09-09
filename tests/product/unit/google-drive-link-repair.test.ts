import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  scope: 'account:creator-1' as string,
  cardSets: [{ id: 'set-1' }],
  writes: [] as Array<{ key: string; value: unknown }>,
  currentBinding: null as null | Record<string, unknown>,
  projects: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/features/project/persistence/structuredBrowserStorage', () => ({
  writeStructuredBrowserValue: vi.fn(async (key: string, value: unknown) => {
    mock.writes.push({ key, value });
    if (key.endsWith(':google-drive-work-binding:set-1')) mock.currentBinding = value as Record<string, unknown>;
  }),
}));

vi.mock('@/features/project/persistence/projectPersistenceScope', () => ({
  getProjectPersistenceScope: () => mock.scope,
  getScopedProjectStorageNamespace: (base: string) => `${base}:${mock.scope}`,
}));

vi.mock('@/features/project/store/workspaceStore', () => ({
  useProjectStore: { getState: () => ({ cardSets: mock.cardSets }) },
}));

vi.mock('@/features/project/client/googleDriveProjectTransfer', () => ({
  getGoogleDriveWorkBinding: vi.fn(async () => mock.currentBinding),
  loadGoogleDriveProjectLibrary: vi.fn(async () => ({ projects: mock.projects })),
}));

import { repairConfirmedGoogleDriveLink } from '@/features/project/client/googleDriveLinkRepair';

const receipt = () => ({
  fileId: 'drive-file-12345',
  name: 'Arcane Set.cardforge',
  providerRevision: `head:${'a'.repeat(64)}`,
  projectRevision: 'b'.repeat(64),
  lastSavedAt: '2026-09-09T00:00:00.000Z',
  webViewLink: 'https://drive.google.com/file/d/drive-file-12345/view',
  accountId: 'google-user-1',
  workId: 'set-1',
  packageScope: 'set' as const,
});

const currentProject = () => ({
  provider: 'google-drive',
  fileId: 'drive-file-12345',
  name: 'Arcane Set.cardforge',
  providerRevision: `head:${'a'.repeat(64)}`,
  projectRevision: 'b'.repeat(64),
  accountId: 'google-user-1',
  modifiedAt: '2026-09-09T00:00:00.000Z',
  size: 100,
  webViewLink: 'https://drive.google.com/file/d/drive-file-12345/view',
  workId: 'set-1',
});

describe('confirmed Google Drive linkage repair', () => {
  beforeEach(() => {
    mock.scope = 'account:creator-1';
    mock.cardSets = [{ id: 'set-1' }];
    mock.writes = [];
    mock.currentBinding = null;
    mock.projects = [currentProject()];
  });

  it('repairs browser linkage from an exact provider receipt without another upload', async () => {
    await expect(repairConfirmedGoogleDriveLink(receipt())).resolves.toMatchObject({
      fileId: 'drive-file-12345',
      workId: 'set-1',
      accountId: 'google-user-1',
      projectRevision: 'b'.repeat(64),
    });
    expect(mock.writes).toEqual([
      {
        key: 'project-assets:account:creator-1:google-drive-work-binding:set-1',
        value: expect.objectContaining({ fileId: 'drive-file-12345', workId: 'set-1' }),
      },
      {
        key: 'project-assets:account:creator-1:google-drive-project-binding',
        value: { workId: 'set-1' },
      },
    ]);
  });

  it('refuses repair if Drive changed after the confirmed save', async () => {
    mock.projects = [{ ...currentProject(), providerRevision: `head:${'c'.repeat(64)}` }];
    await expect(repairConfirmedGoogleDriveLink(receipt())).rejects.toThrow(/changed after the confirmed save/i);
    expect(mock.writes).toHaveLength(0);
  });

  it('refuses repair when the local Set is no longer open', async () => {
    mock.cardSets = [];
    await expect(repairConfirmedGoogleDriveLink(receipt())).rejects.toThrow(/no longer open/i);
    expect(mock.writes).toHaveLength(0);
  });

  it('refuses cross-account completion after provider verification', async () => {
    let calls = 0;
    Object.defineProperty(mock, 'scope', {
      configurable: true,
      get: () => (++calls >= 2 ? 'account:creator-2' : 'account:creator-1'),
      set: () => undefined,
    });
    await expect(repairConfirmedGoogleDriveLink(receipt())).rejects.toThrow(/account changed/i);
    expect(mock.writes).toHaveLength(0);
    Object.defineProperty(mock, 'scope', { configurable: true, writable: true, value: 'account:creator-1' });
  });
});
