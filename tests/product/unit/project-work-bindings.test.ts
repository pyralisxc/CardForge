import { createHash } from 'node:crypto';
const headToken = (version: string) => 'head:' + createHash('sha256').update('native-' + version).digest('hex');
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  namespace: 'test',
  beforeWrite: undefined as ((key: string) => Promise<void>) | undefined,
  onWrite: undefined as (() => void) | undefined,
  failWriteKey: null as string | null,
  failRemoveKey: null as string | null,
  values: new Map<string, unknown>(),
  localSets: [] as { id: string }[],
  read: vi.fn(),
  captureSet: vi.fn(async (id: string) => ({ cardSets: [{ id, name: 'C' }], userTemplates: [], storedCards: [], appearanceStyles: [], customAssets: {} })),
  captureWorkspace: vi.fn(async () => ({ cardSets: [{ id: 'unrelated' }, { id: 'set-c' }] })),
  decode: vi.fn(),
  materialize: vi.fn(async (snapshot: { document: unknown }) => snapshot.document),
  apply: vi.fn(async () => ({ activeSetId: 'set-c' })),
  build: vi.fn(async ({ document, name }: { document: unknown; name: string }) => ({ document, manifest: { name, projectRevision: 'b'.repeat(64), savedAt: '2026-09-05' } })),
  verifySnapshot: vi.fn(async () => undefined),
  makeZip: vi.fn(async () => new Blob(['package'])),
  prime: vi.fn(async () => 1),
}));
vi.mock('@/features/project/persistence/structuredBrowserStorage', () => ({
  readStructuredBrowserValue: mock.read,
  writeStructuredBrowserValue: async (key: string, value: unknown) => {
    await mock.beforeWrite?.(key);
    if (key === mock.failWriteKey) throw new Error('Browser storage rejected the binding');
    mock.values.set(key, value);
    mock.onWrite?.();
  },
  removeStructuredBrowserValue: async (key: string) => { if (key === mock.failRemoveKey) throw new Error('Browser storage rejected removal'); mock.values.delete(key); },
}));
vi.mock('@/features/project/persistence/projectPersistenceScope', () => ({ getScopedProjectStorageNamespace: () => mock.namespace, getProjectPersistenceScope: () => mock.namespace }));
vi.mock('@/features/project/client/projectWorkspaceDocument', () => ({
  captureCardSetProjectDocument: mock.captureSet,
  captureCurrentProjectDocument: mock.captureWorkspace,
  applyProjectDocumentToWorkspace: mock.apply,
  hasProjectDocumentStateChanged: () => false,
}));
vi.mock('@/features/project/client/browserProjectPackage', () => ({ buildBrowserCardForgeProjectSnapshot: mock.build, decodeBrowserProjectFile: mock.decode, materializeBrowserProjectSnapshot: mock.materialize }));
vi.mock('@/features/project/lib/projectPackageAssetReferences', () => ({ referenceCardForgeProjectSnapshotAssets: (snapshot: { document: unknown }) => snapshot.document }));
vi.mock('@/features/project/client/useProjectBinaryAssetUrl', () => ({ primeProjectBinaryAssetUrls: mock.prime }));
vi.mock('@/features/project/lib/projectPackageCodec', () => ({
  ProjectPackageError: class extends Error {},
  createCardForgeProjectPackageBlob: mock.makeZip,
  writeCardForgeProjectPackage: async () => {},
  decodeProjectFile: mock.decode,
  decodeCardForgeProjectPackage: async (file: File) => {
    const decoded = await mock.decode(file);
    if (decoded.format !== 'cardforge-package' || !decoded.sourceRevision) throw new Error('This remembered folder no longer contains one current CardForge Set. Browser and folder work were left unchanged.');
    return { manifest: { projectRevision: decoded.sourceRevision }, document: decoded.document };
  },
}));
vi.mock('@/features/project/lib/projectPackageWriter', () => ({ verifyProjectPackageSnapshot: mock.verifySnapshot }));
vi.mock('@/features/analytics/client/tracking', () => ({ observeProviderBoundaryResponse: (_provider: string, _action: string, run: () => unknown) => run() }));
vi.mock('@/features/project/store/workspaceStore', () => {
  const state = { get cardSets() { return mock.localSets; }, storedCards: [] };
  return { useProjectStore: { getState: () => state } };
});

import { GOOGLE_DRIVE_WORKING_COPY_REFRESHED_EVENT, resetGoogleDriveTargetSaveStateForTests, serializeGoogleDriveTargetSave, getGoogleDriveSaveBarrier, getGoogleDriveWorkBinding, GoogleDriveUnknownCommitError, GoogleDriveSaveLinkageError, disconnectGoogleDriveStorage, copyGoogleDriveProjectToBrowser, deleteGoogleDriveProjectCopy, getGoogleDriveProjectBinding, loadGoogleDriveProjectLibrary as loadDirectGoogleDriveProjectLibrary, openGoogleDriveProject, refreshGoogleDriveProject, saveCardSetToGoogleDrive, saveCurrentProjectToGoogleDrive } from '@/features/project/client/googleDriveProjectTransfer';
import { repairConfirmedGoogleDriveLink } from '@/features/project/client/googleDriveLinkRepair';
import { loadGoogleDriveProjectLibrary } from '@/features/project/client/provider-google-drive';
import * as localFolder from '@/features/project/client/localProjectFolder';
import { disconnectLocalProjectFolder, getLocalProjectFolderStatus, saveCardSetToAttachedFolder, saveProjectToAttachedFolder } from '@/features/project/client/localProjectFolder';
import { openRememberedLocalProject, LOCAL_PROJECT_FOLDER_CHANGE_EVENT, reconnectAttachedProjectFolder } from '@/features/project/client/localProjectFolder';
import { prepareSelectedSet } from '@/features/project/client/prepareSelectedSet';

const driveBinding = { fileId: 'drive-file-12345', name: 'C', providerRevision: '1', projectRevision: 'a'.repeat(64), workId: 'set-c' };
const folder = (name: string) => {
  const handle = {
    name,
    queryPermission: vi.fn(async (): Promise<'granted' | 'denied' | 'prompt'> => 'granted'),
    isSameEntry: vi.fn(async (other: { name: string }) => other.name === name),
    getFileHandle: vi.fn(async (_filename: string, _options?: { create: boolean }) => ({ getFile: async () => new Blob(['package']), createWritable: async () => ({ abort: async () => {} }) })),
  };
  return handle;
};

beforeEach(() => {
  resetGoogleDriveTargetSaveStateForTests();
  vi.clearAllMocks();
  mock.values.clear();
  mock.build.mockReset();
  mock.build.mockImplementation(async ({ document, name }: { document: unknown; name: string }) => ({
    document, manifest: { name, projectRevision: 'b'.repeat(64), savedAt: '2026-09-05' },
  }));
  mock.namespace = 'test';
  mock.onWrite = undefined;
  mock.beforeWrite = undefined;
  mock.failWriteKey = null;
  mock.failRemoveKey = null;
  mock.localSets = [];
  mock.read.mockImplementation(async (key: string) => mock.values.get(key) ?? null);
  mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64) });
  vi.stubGlobal('window', { showDirectoryPicker: vi.fn(), dispatchEvent: vi.fn() });
});

describe('one authoritative Set location across save entry points', () => {
  it('retains the selected Drive folder name across a paginated project read', async () => {
    const connection = { connected: true, accountId: 'account-a', rootFolderId: 'folder12345', displayName: 'Account' };
    const selectedFolder = { id: 'folder12345', name: 'QA folder' };
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ connection, selectedFolder, projects: [], nextPageToken: 'next' }))
      .mockResolvedValueOnce(Response.json({ connection, selectedFolder, projects: [], nextPageToken: null }));
    vi.stubGlobal('fetch', fetch);
    await expect(loadDirectGoogleDriveProjectLibrary()).resolves.toMatchObject({ selectedFolder, projects: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not present a repeated Drive page as a complete folder', async () => {
    const connection = { connected: true, accountId: 'account-a', rootFolderId: 'folder12345', displayName: 'Account' };
    const page = { connection, selectedFolder: { id: 'folder12345', name: 'QA folder' }, projects: [], nextPageToken: 'repeat' };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(page)));
    await expect(loadDirectGoogleDriveProjectLibrary()).rejects.toThrow('repeated a project-list page');
  });

  it('rejects mixed Drive accounts across empty pages even if names and folders match', async () => {
    const connection = { connected: true, accountId: 'account-a', rootFolderId: 'folder12345', displayName: 'Account' };
    const selectedFolder = { id: 'folder12345', name: 'QA folder' };
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ connection, selectedFolder, projects: [], nextPageToken: 'next' }))
      .mockResolvedValueOnce(Response.json({ connection: { ...connection, accountId: 'account-b' }, selectedFolder, projects: [], nextPageToken: null }));
    vi.stubGlobal('fetch', fetch);
    await expect(loadDirectGoogleDriveProjectLibrary()).rejects.toThrow('connection changed');
  });

  it('lists the remembered folder only with existing read permission and never writes', async () => {
    const handle = { ...folder('Saved folder'), values: async function* () { yield { name: 'notes.txt', kind: 'file' as const }; yield { name: 'project.cardforge', kind: 'file' as const }; } };
    const binding = { handle, folderName: 'Saved folder', sourceRevision: 'b'.repeat(64), packageScope: 'workspace' };
    mock.values.set('test:local-project-folder-binding', binding);
    const before = [...mock.values.entries()];
    await expect(localFolder.listLocalProjectFolderContents(binding as never)).resolves.toEqual([{ name: 'notes.txt', kind: 'file' }, { name: 'project.cardforge', kind: 'file' }]);
    expect([...mock.values.entries()]).toEqual(before);
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
  });

  it('does not request permission or enumerate a folder that needs reconnecting', async () => {
    const handle = { ...folder('Locked folder'), queryPermission: vi.fn(async () => 'prompt' as const), requestPermission: vi.fn(), values: vi.fn() };
    const binding = { handle, folderName: 'Locked folder', sourceRevision: 'b'.repeat(64), packageScope: 'workspace' };
    mock.values.set('test:local-project-folder-binding', binding);
    await expect(localFolder.listLocalProjectFolderContents(binding as never)).rejects.toThrow('Reconnect this folder');
    expect(handle.requestPermission).not.toHaveBeenCalled();
    expect(handle.values).not.toHaveBeenCalled();
  });

  it('prepares an already-loaded Set without downloading or importing it again', () => {
    mock.localSets = [{ id: 'set-c' }];
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(prepareSelectedSet({ name: 'C', references: { localSetId: 'set-c', driveFileId: driveBinding.fileId, driveAccountId: 'account-a' } })).toEqual({ setId: 'set-c' });
    expect(fetch).not.toHaveBeenCalled(); expect(mock.apply).not.toHaveBeenCalled();
  });

  it('prepares the existing exact Drive account and file without a second download', async () => {
    const binding = { ...driveBinding, accountId: 'account-a', packageScope: 'set' };
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:google-drive-work-binding:set-c', binding);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(prepareSelectedSet({ name: 'C', references: { driveFileId: driveBinding.fileId, driveAccountId: 'account-a' } })).resolves.toEqual({ setId: 'set-c', driveBinding: binding });
    expect(fetch).not.toHaveBeenCalled(); expect(mock.apply).not.toHaveBeenCalled();
  });

  it('refuses absent or changed Drive account identity before applying a Set', async () => {
    const fetch = vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'different-account',
    } }));
    vi.stubGlobal('fetch', fetch);
    await expect(prepareSelectedSet({ name: 'C', references: { driveFileId: driveBinding.fileId } })).rejects.toThrow('selected Google Drive account');
    expect(fetch).not.toHaveBeenCalled();
    await expect(prepareSelectedSet({ name: 'C', references: { driveFileId: driveBinding.fileId, driveAccountId: 'account-a' } })).rejects.toThrow('account changed');
    expect(mock.apply).not.toHaveBeenCalled();
  });

  it('leaves workspace backups untouched when preparing a selected Set', async () => {
    const binding = { ...driveBinding, accountId: 'account-a', packageScope: 'workspace' };
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:google-drive-work-binding:set-c', binding);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(prepareSelectedSet({ name: 'Backup', references: { driveFileId: driveBinding.fileId, driveAccountId: 'account-a' } }, { requireSingleSet: true })).rejects.toThrow('workspace backup');
    expect(fetch).not.toHaveBeenCalled(); expect(mock.apply).not.toHaveBeenCalled();
    await expect(prepareSelectedSet({ name: 'Backup', references: { driveFileId: driveBinding.fileId, driveAccountId: 'account-a' } })).resolves.toEqual({ setId: 'set-c', driveBinding: binding });
  });

  it.each([1, 2])('prepares a %i-Set Drive package with the correct Output preference policy', async (count) => {
    const document = { cardSets: Array.from({ length: count }, (_, index) => ({ id: `old-${index}` })), userTemplates: [], storedCards: [], appearanceStyles: [], customAssets: {} };
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'account-a',
    } })));
    await prepareSelectedSet({ name: 'C', references: { driveFileId: driveBinding.fileId, driveAccountId: 'account-a' } }, { preserveCurrent: true });
    expect(mock.apply).toHaveBeenCalledWith(expect.any(Object), 'merge', expect.objectContaining({ expectedState: expect.any(Object), preserveActiveSet: true, ...(count === 1 ? { preserveOutputPreferences: true } : {}) }));
    if (count === 2) expect((mock.apply.mock.calls as unknown as Array<[unknown, unknown, Record<string, unknown>]>).at(-1)?.[2]).not.toHaveProperty('preserveOutputPreferences');
  });

  it('keeps a single device-binding pass for direct Drive library consumers', async () => {
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:google-drive-work-binding:set-c', { ...driveBinding, accountId: 'account-a' });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ connection: { status: 'active' }, projects: [
      { fileId: driveBinding.fileId, name: 'C', accountId: 'account-a', thumbnailLink: null },
    ] })));
    expect((await loadDirectGoogleDriveProjectLibrary()).projects[0]).toMatchObject({ localWorkId: 'set-c' });
    expect(mock.read).toHaveBeenCalledTimes(1);
  });

  it('rechecks device bindings when a shared Drive list started before a Set was opened', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    mock.localSets = [{ id: 'old-set' }];
    const fetch = vi.fn(async () => { await blocked; return Response.json({ connection: { status: 'active' }, projects: [
      { fileId: driveBinding.fileId, name: 'C', accountId: 'account-a', thumbnailLink: null },
    ] }); });
    vi.stubGlobal('fetch', fetch);
    const earlier = loadGoogleDriveProjectLibrary();
    mock.localSets = [{ id: 'old-set' }, { id: 'set-c' }];
    mock.values.set('test:google-drive-work-binding:set-c', { ...driveBinding, accountId: 'account-a' });
    const afterOpen = loadGoogleDriveProjectLibrary();
    release();
    await earlier;
    expect((await afterOpen).projects[0]).toMatchObject({ localWorkId: 'set-c' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mock.read).toHaveBeenCalledTimes(4);
  });

  it('resumes the exact file/account working Set without downloading or importing again', async () => {
    const binding = { ...driveBinding, accountId: 'account-a', portableWorkId: 'old-set' };
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:google-drive-work-binding:set-c', binding);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C', accountId: 'account-a' })).toEqual(binding);
    expect(mock.apply).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a known workspace backup when selecting one Set, without downloading or changing work', async () => {
    const binding = { ...driveBinding, accountId: 'account-a', packageScope: 'workspace' };
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:google-drive-work-binding:set-c', binding);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C', accountId: 'account-a' }, { requireSingleSet: true })).rejects.toThrow('workspace backup');
    expect(fetch).not.toHaveBeenCalled();
    expect(mock.apply).not.toHaveBeenCalled();
  });

  it('validates a newly selected Drive Set before applying it', async () => {
    mock.decode.mockImplementationOnce(async (_file, validate) => {
      validate({ cardSets: [{ id: 'one' }, { id: 'two' }], storedCards: [], userTemplates: [] });
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'account-a',
    } })));
    await expect(openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C', accountId: 'account-a' }, { requireSingleSet: true })).rejects.toThrow('exactly one Set');
    expect(mock.apply).not.toHaveBeenCalled();
    expect(mock.prime).not.toHaveBeenCalled();
  });

  it('refuses refresh of dirty working data before downloading or replacing anything', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(refreshGoogleDriveProject({ ...driveBinding, lastSavedAt: '2026-09-01', webViewLink: null, accountId: 'account-a', packageScope: 'set', identities: {}, localProjectRevision: 'c'.repeat(64) })).rejects.toThrow('browser changes');
    expect(mock.apply).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not publish a clean baseline if the account changes during verification', async () => {
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document: {
      cardSets: [{ id: 'original' }], userTemplates: [], storedCards: [], appearanceStyles: [], customAssets: {},
    } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'account-a',
    } })));
    mock.verifySnapshot.mockImplementationOnce(async () => { mock.namespace = 'other-account'; });
    await expect(openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C', accountId: 'account-a' })).rejects.toThrow('account changed');
    expect(mock.makeZip).not.toHaveBeenCalled();
    for (const [key, value] of mock.values) {
      if (key.includes('google-drive-work-binding:')) expect(value).not.toHaveProperty('localProjectRevision');
    }
  });

  it('makes intentional copies independent of their source save target', async () => {
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document: { cardSets: [{ id: 'original' }] } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'account-a',
    } })));
    await copyGoogleDriveProjectToBrowser({ fileId: driveBinding.fileId, name: 'C' });
    expect(mock.apply).toHaveBeenCalledWith({ cardSets: [{ id: 'original' }] }, 'copy', { expectedState: expect.any(Object) });
    expect(mock.values.size).toBe(0);
  });

  it('does not import a Drive copy when the selected account changed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'other-account',
    } })));
    await expect(copyGoogleDriveProjectToBrowser({ fileId: driveBinding.fileId, name: 'C', accountId: 'selected-account' })).rejects.toThrow('account changed');
    expect(mock.apply).not.toHaveBeenCalled();
  });

  it('returns a successful independent import even when no active Set is available', async () => {
    mock.apply.mockResolvedValueOnce({ activeSetId: null } as never);
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document: { cardSets: [] } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'selected-account',
    } })));
    await expect(copyGoogleDriveProjectToBrowser({ fileId: driveBinding.fileId, name: 'C', accountId: 'selected-account' })).resolves.toMatchObject({ workId: null });
    expect(mock.apply).toHaveBeenCalledOnce();
  });

  it.each([1, 2])('retains explicit package scope when opening a %i-Set historical package', async (count) => {
    const document = { cardSets: Array.from({ length: count }, (_, index) => ({ id: `old-${index}` })), userTemplates: [], storedCards: [], appearanceStyles: [], customAssets: {} };
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64),
      'X-CardForge-Provider-Account': 'google-account-1',
    } })));
    const binding = await openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C' });
    if (count === 1) {
      expect(binding.localProjectRevision).toBe('b'.repeat(64));
      expect(mock.verifySnapshot).toHaveBeenCalledOnce();
      expect(mock.makeZip).not.toHaveBeenCalled();
    }
    expect(mock.prime).toHaveBeenCalledWith(expect.objectContaining({ cardSets: expect.any(Array) }));
    expect(mock.apply).toHaveBeenCalledWith(expect.objectContaining({ cardSets: expect.any(Array) }), 'merge', expect.objectContaining({ expectedState: expect.any(Object) }));
    expect(mock.prime.mock.invocationCallOrder[0]).toBeLessThan(mock.apply.mock.invocationCallOrder[0]);
    expect(binding.workId).toBe(binding.runtimeSetIds?.[0]);
    expect(binding.packageScope).toBe(count === 1 ? 'set' : 'workspace');
    expect(mock.values.has(`test:google-drive-work-binding:${binding.workId}`)).toBe(true);
    expect(await getGoogleDriveProjectBinding()).toEqual(binding);
  });

  it('keeps the same Drive file and one-Set scope when alternating Locations and Set saves', async () => {
    mock.values.set('test:google-drive-project-binding', { ...driveBinding, providerRevision: 'stale' });
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    let version = 1;
    const prepare: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        prepare.push(JSON.parse(options.body as string));
        return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' });
      }
      return Response.json({ id: driveBinding.fileId, version: String(++version), headRevisionId: `native-${version}`, name: 'C' });
    }));
    const renderThumbnail = vi.fn(async () => 'canonical-preview');
    await saveCurrentProjectToGoogleDrive({ name: 'C', renderThumbnail });
    const expectedBinding = await getGoogleDriveWorkBinding('set-c');
    await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C', expectedBinding: expectedBinding!, renderThumbnail });
    await saveCurrentProjectToGoogleDrive({ name: 'C' });
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
    expect(mock.captureSet).toHaveBeenCalledTimes(3);
    expect(renderThumbnail).toHaveBeenCalledWith(expect.objectContaining({ cardSets: [{ id: 'set-c', name: 'C' }] }));
    expect(prepare[0]).toMatchObject({ thumbnail: 'canonical-preview' });
    expect(prepare[1]).toMatchObject({ fileId: driveBinding.fileId, thumbnail: 'canonical-preview' });
    expect(prepare.map((value) => [value.fileId, value.workId, value.expectedProviderRevision])).toEqual([
      [driveBinding.fileId, 'set-c', '1'], [driveBinding.fileId, 'set-c', headToken('2')], [driveBinding.fileId, 'set-c', headToken('3')],
    ]);
    expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: 'set-c' });
    expect(await getGoogleDriveProjectBinding()).toMatchObject({ providerRevision: headToken('4') });
  });

  it('does not create a Drive destination when a direct save loses its captured link', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C', expectedBinding: driveBinding })).rejects.toThrow('linked Drive document changed');
    mock.values.set('test:google-drive-work-binding:set-c', { ...driveBinding, fileId: 'drive-file-other' });
    await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C', expectedBinding: driveBinding })).rejects.toThrow('linked Drive document changed');
    expect(fetch).not.toHaveBeenCalled();
    expect(mock.captureSet).not.toHaveBeenCalled();
  });

  it('passes the selected account and folder through the native save preparation', async () => {
    const prepares: Record<string, unknown>[] = [];
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') { prepares.push(JSON.parse(options.body as string)); return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C', accountId: 'account-a' }); }
      return Response.json({ id: 'drive-file-12345', name: 'C', headRevisionId: 'native-1' });
    });
    vi.stubGlobal('fetch', fetch);
    await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C', expectedBinding: null, expectedDestination: { accountId: 'account-a', folderId: 'folder-12345' } });
    expect(prepares).toEqual([expect.objectContaining({ expectedAccountId: 'account-a', expectedFolderId: 'folder-12345', fileId: null })]);
  });

  it('refuses a newly linked Drive destination when a move captured no link', async () => {
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C', expectedBinding: null })).rejects.toThrow('linked after this move opened');
    expect(fetch).not.toHaveBeenCalled();
    expect(mock.captureSet).not.toHaveBeenCalled();
  });

  it('does not open a new folder when a direct save loses its captured link', async () => {
    const handle = folder('C');
    const binding = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) };
    await expect(saveCardSetToAttachedFolder('set-c', binding as unknown as localFolder.LocalProjectFolderBinding)).rejects.toThrow('linked folder changed');
    mock.values.set('test:local-work-folder-binding:set-c', { ...binding, handle: folder('Other') });
    await expect(saveCardSetToAttachedFolder('set-c', binding as unknown as localFolder.LocalProjectFolderBinding)).rejects.toThrow('linked folder changed');
    expect((window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker).not.toHaveBeenCalled();
    expect(mock.captureSet).not.toHaveBeenCalled();
  });

  it('saves a folder attachment using its canonical Set revision and scope', async () => {
    const handle = folder('C');
    mock.values.set('test:local-project-folder-binding', { workId: 'set-c', sourceRevision: 'stale' });
    mock.values.set('test:local-work-folder-binding:set-c', { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) });
    await saveProjectToAttachedFolder();
    await saveCardSetToAttachedFolder('set-c');
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
    expect(mock.captureSet).toHaveBeenCalledTimes(2);
    expect(mock.values.get('test:local-project-folder-binding')).toEqual({ workId: 'set-c' });
  });

  it('saves and reopens using the same owner filename', async () => {
    const handle = folder('C');
    mock.localSets = [{ id: 'set-c' }];
    const revision = 'b'.repeat(64);
    const document = { cardSets: [{ id: 'set-c', name: 'C' }] };
    const filename = localFolder.getLocalProjectFileName();
    handle.getFileHandle.mockImplementation(async (requestedName: string) => {
      if (requestedName !== filename) throw new DOMException('File not found', 'NotFoundError');
      return { getFile: async () => new Blob(['package']), createWritable: async () => ({ abort: async () => {} }) };
    });
    mock.values.set('test:local-work-folder-binding:set-c', { handle, folderName: 'C', workId: 'set-c', sourceRevision: revision });
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: revision, document });
    const saved = await saveCardSetToAttachedFolder('set-c');
    expect(saved).toMatchObject({ workId: 'set-c', sourceRevision: revision });
    expect(handle.getFileHandle).toHaveBeenCalledWith(filename, { create: true });
    handle.getFileHandle.mockClear();
    expect(await openRememberedLocalProject('set-c')).toEqual({ setId: 'set-c', sourceRevision: revision });
    expect(handle.getFileHandle).toHaveBeenCalledWith(filename);
    expect(mock.apply).not.toHaveBeenCalled();
  });

  it('resumes an existing legacy binding even when the folder Set has a different portable ID', async () => {
    const handle = folder('C');
    const binding = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) };
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:local-work-folder-binding:set-c', binding);
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: binding.sourceRevision,
      document: { cardSets: [{ id: 'portable-set' }] } });
    await expect(openRememberedLocalProject('set-c')).resolves.toEqual({ setId: 'set-c', sourceRevision: binding.sourceRevision });
    expect(mock.apply).not.toHaveBeenCalled();
    expect(mock.values.get('test:local-work-folder-binding:set-c')).toBe(binding);
  });

  it('blocks a changed folder without replacing browser work or advancing the saved revision', async () => {
    const handle = folder('C');
    const binding = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'a'.repeat(64) };
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:local-work-folder-binding:set-c', binding);
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document: { cardSets: [{ id: 'set-c' }] } });
    await expect(openRememberedLocalProject('set-c')).rejects.toThrow(/changed.*Back up both copies.*do not save over the folder/);
    expect(mock.apply).not.toHaveBeenCalled();
    expect(mock.materialize).not.toHaveBeenCalled();
    expect(mock.decode).toHaveBeenCalledTimes(1);
    expect(mock.values.get('test:local-work-folder-binding:set-c')).toBe(binding);
  });

  it('restores a missing browser Set under its remembered identity without replacing other work', async () => {
    const handle = folder('C');
    const binding = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) };
    mock.values.set('test:local-work-folder-binding:set-c', binding);
    mock.localSets = [{ id: 'other-set' }];
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: binding.sourceRevision,
      document: { cardSets: [{ id: 'portable-set' }], activeCardSetId: 'portable-set', userTemplates: [], storedCards: [], customAssets: {}, appearanceStyles: [] } });
    await expect(openRememberedLocalProject('set-c')).resolves.toEqual({ setId: 'set-c', sourceRevision: binding.sourceRevision });
    expect(mock.apply).toHaveBeenCalledWith(expect.objectContaining({ cardSets: [{ id: 'set-c' }], activeCardSetId: 'set-c' }), 'merge', {
      expectedState: expect.any(Object),
      preserveOutputPreferences: true,
    });
    expect(mock.localSets).toEqual([{ id: 'other-set' }]);
    expect(mock.values.get('test:local-work-folder-binding:set-c')).toBe(binding);
    expect(handle.getFileHandle).toHaveBeenCalledWith('project.cardforge');
    expect(mock.decode).toHaveBeenCalledTimes(1);
    expect(mock.materialize).toHaveBeenCalledTimes(1);
  });

  it('uses native directory identity to resume the same Set from the picker without importing again', async () => {
    const handle = folder('C');
    const binding = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) };
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:local-work-folder-binding-index', ['set-c']);
    mock.values.set('test:local-work-folder-binding:set-c', binding);
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: binding.sourceRevision, document: { cardSets: [{ id: 'portable-set' }] } });
    vi.mocked((window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker).mockResolvedValue(handle);
    expect(await getLocalProjectFolderStatus()).toMatchObject({ binding: null });
    await expect(localFolder.openProjectFromFolder()).resolves.toMatchObject({ workId: 'set-c' });
    expect(handle.isSameEntry).toHaveBeenCalledWith(handle);
    expect(mock.apply).not.toHaveBeenCalled();
    expect(await getLocalProjectFolderStatus()).toMatchObject({
      binding: expect.objectContaining({ workId: 'set-c', folderName: 'C' }),
    });
  });

  it('keeps the current attachment when a known picker folder fails revision validation', async () => {
    const selectedHandle = folder('A');
    const attachedHandle = folder('B');
    const selectedBinding = { handle: selectedHandle, folderName: 'A', workId: 'set-a', sourceRevision: 'a'.repeat(64) };
    const attachedBinding = { handle: attachedHandle, folderName: 'B', workId: 'set-b', sourceRevision: 'c'.repeat(64) };
    mock.localSets = [{ id: 'set-a' }, { id: 'set-b' }];
    mock.values.set('test:local-project-folder-binding', { workId: 'set-b' });
    mock.values.set('test:local-work-folder-binding-index', ['set-a', 'set-b']);
    mock.values.set('test:local-work-folder-binding:set-a', selectedBinding);
    mock.values.set('test:local-work-folder-binding:set-b', attachedBinding);
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document: { cardSets: [{ id: 'portable-a' }] } });
    vi.mocked((window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker).mockResolvedValue(selectedHandle);
    await expect(localFolder.openProjectFromFolder()).rejects.toThrow(/folder has changed.*do not save over the folder/);
    expect(mock.values.get('test:local-project-folder-binding')).toEqual({ workId: 'set-b' });
    expect(await getLocalProjectFolderStatus()).toMatchObject({
      binding: expect.objectContaining({ workId: 'set-b', folderName: 'B' }),
    });
    expect(mock.apply).not.toHaveBeenCalled();
  });


  it('opens a saved Set with read permission, without demanding write access', async () => {
    const handle = folder('Read only');
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:local-work-folder-binding:set-c', {
      handle, folderName: 'Read only', workId: 'set-c', sourceRevision: 'b'.repeat(64),
    });
    mock.decode.mockResolvedValue({
      format: 'cardforge-package', sourceRevision: 'b'.repeat(64),
      document: { cardSets: [{ id: 'portable-set' }] },
    });
    handle.queryPermission.mockImplementation(async (options?: { mode?: string }) =>
      options?.mode === 'read' ? 'granted' : 'prompt');
    await expect(openRememberedLocalProject('set-c')).resolves.toMatchObject({ setId: 'set-c' });
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(handle.queryPermission).not.toHaveBeenCalledWith({ mode: 'readwrite' });
    mock.values.set('test:local-project-folder-binding', { workId: 'set-c' });
    expect(await getLocalProjectFolderStatus()).toMatchObject({ readPermission: 'granted', permission: 'prompt' });
  });

  it('requests reconnect permission before IndexedDB reads and invalidates after a confirmed binding', async () => {
    const handle = folder('C');
    const saved = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) };
    mock.values.set('test:local-project-folder-binding', { workId: 'set-c' });
    mock.values.set('test:local-work-folder-binding:set-c', saved);
    let readStarted = false;
    mock.read.mockImplementation(async (key: string) => { readStarted = true; return mock.values.get(key) ?? null; });
    handle.queryPermission.mockResolvedValueOnce('prompt');
    const requestPermission = vi.fn(async ({ mode }: { mode?: string }) => {
      expect(mode).toBe('readwrite');
      expect(readStarted).toBe(false);
      return 'granted' as const;
    });
    const nativeHandle = Object.assign(handle, { requestPermission });
    expect(await reconnectAttachedProjectFolder(nativeHandle as unknown as FileSystemDirectoryHandle)).toBe(saved);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: LOCAL_PROJECT_FOLDER_CHANGE_EVENT }));
    expect(mock.values.get('test:local-project-folder-binding')).toEqual({ workId: 'set-c' });
    expect(handle.getFileHandle).not.toHaveBeenCalled();
  });

  it('rejects a mismatched reconnect handle without rebinding or dispatching', async () => {
    const attached = folder('Attached');
    const wrong = folder('Wrong');
    mock.values.set('test:local-project-folder-binding', { workId: 'set-c' });
    mock.values.set('test:local-work-folder-binding:set-c', { handle: attached, folderName: 'Attached', workId: 'set-c' });
    await expect(reconnectAttachedProjectFolder(wrong as unknown as FileSystemDirectoryHandle)).rejects.toThrow('selected folder changed');
    expect(mock.values.get('test:local-project-folder-binding')).toEqual({ workId: 'set-c' });
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    expect(wrong.getFileHandle).not.toHaveBeenCalled();
  });

  it('preserves verified workspace backup saves', async () => {
    const handle = folder('backup');
    mock.values.set('test:local-project-folder-binding', { handle, folderName: 'backup', sourceRevision: 'b'.repeat(64), packageScope: 'workspace' });
    await saveProjectToAttachedFolder();
    expect(mock.captureWorkspace).toHaveBeenCalledOnce();
    expect(mock.captureSet).not.toHaveBeenCalled();
  });
});

describe('location failure and detach safety', () => {
  it.each([0, 2])('refuses a remembered folder containing %i Sets without importing', async (count) => {
    const handle = folder('C');
    const binding = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) };
    mock.values.set('test:local-work-folder-binding:set-c', binding);
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: binding.sourceRevision,
      document: { cardSets: Array.from({ length: count }, (_, id) => ({ id: `set-${id}` })) } });
    await expect(openRememberedLocalProject('set-c')).rejects.toThrow('one current CardForge Set');
    expect(mock.apply).not.toHaveBeenCalled();
    expect(mock.values.get('test:local-work-folder-binding:set-c')).toBe(binding);
  });

  it('preserves work and binding when the remembered package is missing', async () => {
    const handle = folder('C');
    const binding = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) };
    mock.values.set('test:local-work-folder-binding:set-c', binding);
    handle.getFileHandle.mockRejectedValue(new DOMException('Missing', 'NotFoundError'));
    await expect(openRememberedLocalProject('set-c')).rejects.toThrow('does not contain project.cardforge');
    expect(mock.apply).not.toHaveBeenCalled();
    expect(mock.values.get('test:local-work-folder-binding:set-c')).toBe(binding);
  });

  it.each(['permission', 'revision', 'account'] as const)(
    'refuses remembered folder reopen on %s failure without applying work', async (failure) => {
      const handle = folder('C');
      const binding = { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) };
      mock.values.set('test:local-work-folder-binding:set-c', binding);
      mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: failure === 'revision' ? null : 'b'.repeat(64),
        document: { cardSets: [{ id: 'set-c' }] } });
      if (failure === 'permission') handle.queryPermission.mockResolvedValue('denied');
      if (failure === 'account') handle.queryPermission.mockImplementation(async () => { mock.namespace = 'other'; return 'granted'; });
      await expect(openRememberedLocalProject('set-c')).rejects.toThrow({
        permission: 'needs read permission again', revision: 'one current CardForge Set', account: 'account changed',
      }[failure]);
      expect(mock.apply).not.toHaveBeenCalled();
      expect(mock.values.get('test:local-work-folder-binding:set-c')).toBe(binding);
      if (failure === 'permission') expect(handle.getFileHandle).not.toHaveBeenCalled();
    },
  );
  it('rejects a folder attachment read when the account changes before it resolves', async () => {
    const handle = folder('A');
    mock.read.mockImplementationOnce(async () => {
      mock.namespace = 'other';
      return { handle, folderName: 'A', packageScope: 'workspace' };
    });
    await expect(saveProjectToAttachedFolder()).rejects.toThrow('account changed');
    expect(handle.getFileHandle).not.toHaveBeenCalled();
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
    expect(mock.values.size).toBe(0);
  });

  it('never transfers a verified folder binding to another account during persistence', async () => {
    const handle = folder('A');
    mock.values.set('test:local-work-folder-binding:set-c', { handle, folderName: 'A', workId: 'set-c', sourceRevision: 'b'.repeat(64) });
    mock.onWrite = () => { mock.namespace = 'other'; };
    await expect(saveCardSetToAttachedFolder('set-c')).rejects.toThrow('account changed');
    expect([...mock.values.keys()].some((key) => key.startsWith('other:'))).toBe(false);
    expect(mock.values.has('test:local-work-folder-binding:set-c')).toBe(true);
  });

  it('keeps unscoped historical attachments readable but refuses to overwrite them', async () => {
    const handle = folder('old');
    const drive = { fileId: driveBinding.fileId, name: 'old', providerRevision: '1', projectRevision: driveBinding.projectRevision };
    mock.values.set('test:google-drive-project-binding', drive);
    mock.values.set('test:local-project-folder-binding', { handle, folderName: 'old', sourceRevision: 'b'.repeat(64) });
    expect(await getGoogleDriveProjectBinding()).toEqual(drive);
    expect((await getLocalProjectFolderStatus()).binding?.folderName).toBe('old');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(saveCurrentProjectToGoogleDrive({ name: 'old' })).rejects.toThrow('Reopen');
    await expect(saveProjectToAttachedFolder()).rejects.toThrow('Reopen');
    expect(fetch).not.toHaveBeenCalled();
    expect(handle.getFileHandle).not.toHaveBeenCalled();
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
  });

  it('clears only matching local bindings after the exact Drive file is moved to Trash', async () => {
    mock.localSets = [{ id: 'set-c' }, { id: 'other' }];
    mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    mock.values.set('test:google-drive-work-binding:other', { ...driveBinding, workId: 'other', fileId: 'other-file-12345' });
    vi.stubGlobal('fetch', vi.fn(async () => {
      expect(mock.values.has('test:google-drive-work-binding:set-c')).toBe(true);
      return new Response(null, { status: 204 });
    }));
    await deleteGoogleDriveProjectCopy({ fileId: driveBinding.fileId, providerRevision: '1', projectRevision: driveBinding.projectRevision });
    expect(mock.values.has('test:google-drive-work-binding:set-c')).toBe(false);
    expect(mock.values.has('test:google-drive-project-binding')).toBe(false);
    expect(mock.values.has('test:google-drive-work-binding:other')).toBe(true);
  });

  it('does not trash a Drive file when local attachment metadata cannot be read', async () => {
    mock.read.mockRejectedValue(new Error('Storage unavailable'));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(deleteGoogleDriveProjectCopy({ fileId: driveBinding.fileId, providerRevision: '1', projectRevision: driveBinding.projectRevision })).rejects.toThrow('Storage unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retains local bindings if the Drive Trash request fails', async () => {
    mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Revision conflict' } }, { status: 409 })));
    await expect(deleteGoogleDriveProjectCopy({ fileId: driveBinding.fileId, providerRevision: '1', projectRevision: driveBinding.projectRevision })).rejects.toThrow();
    expect(mock.values.get('test:google-drive-work-binding:set-c')).toEqual(driveBinding);
    expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: 'set-c' });
  });

  it.each(['network', 'server'] as const)('holds the Drive file after an unconfirmed %s Trash result', async (failure) => {
    mock.localSets = [{ id: 'set-c' }];
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    const fetch = vi.fn(async () => {
      if (failure === 'network') throw new Error('connection lost');
      return new Response(null, { status: 503 });
    });
    vi.stubGlobal('fetch', fetch);
    await expect(deleteGoogleDriveProjectCopy(driveBinding)).rejects.toThrow('Trash result is not confirmed');
    expect(await getGoogleDriveWorkBinding('set-c')).toEqual(driveBinding);
    await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' })).rejects.toThrow('Trash result is not confirmed');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mock.apply).not.toHaveBeenCalled();
  });

  it('forgets all links to the selected folder but keeps other folders and all source files', async () => {
    const handle = folder('selected');
    const other = folder('other');
    mock.values.set('test:local-project-folder-binding', { workId: 'set-c' });
    mock.values.set('test:local-work-folder-binding-index', ['set-c', 'set-d', 'set-other']);
    for (const id of ['set-c', 'set-d', 'set-other']) mock.values.set(`test:local-work-folder-binding:${id}`, { workId: id, handle: id === 'set-other' ? other : handle });
    await disconnectLocalProjectFolder();
    expect(mock.values.has('test:local-project-folder-binding')).toBe(false);
    expect(mock.values.has('test:local-work-folder-binding:set-c')).toBe(false);
    expect(mock.values.has('test:local-work-folder-binding:set-d')).toBe(false);
    expect(mock.values.get('test:local-work-folder-binding-index')).toEqual(['set-other']);
    expect(mock.values.has('test:local-work-folder-binding:set-other')).toBe(true);
    expect(handle.getFileHandle).not.toHaveBeenCalled();
  });

  it('does not turn unreadable bindings into new provider saves or folder selection', async () => {
    mock.read.mockRejectedValue(new Error('Storage unavailable'));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' })).rejects.toThrow('Storage unavailable');
    await expect(saveCardSetToAttachedFolder('set-c')).rejects.toThrow('Storage unavailable');
    await expect(getLocalProjectFolderStatus()).rejects.toThrow('Storage unavailable');
    expect(fetch).not.toHaveBeenCalled();
    expect((window as unknown as { showDirectoryPicker: ReturnType<typeof vi.fn> }).showDirectoryPicker).not.toHaveBeenCalled();
  });

  it('refuses an unresolved old attachment rather than expanding it to a workspace backup', async () => {
    mock.values.set('test:google-drive-project-binding', driveBinding);
    await expect(saveCurrentProjectToGoogleDrive({ name: 'C' })).rejects.toThrow('Reopen');
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
  });

  it('leaves files untouched when the saved folder index is corrupt', async () => {
    const handle = folder('C');
    mock.values.set('test:local-work-folder-binding:set-c', { handle, folderName: 'C', workId: 'set-c', sourceRevision: 'b'.repeat(64) });
    mock.values.set('test:local-work-folder-binding-index', { damaged: true });
    await expect(saveCardSetToAttachedFolder('set-c')).rejects.toThrow('index is unreadable');
    expect(handle.getFileHandle).not.toHaveBeenCalled();
    expect(mock.values.get('test:local-work-folder-binding-index')).toEqual({ damaged: true });
  });
});

it('does not publish bindings into a newly selected account during a multi-Set open', async () => {
  mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document: {
    version: 1, cardSets: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }], userTemplates: [], storedCards: [], appearanceStyles: [], exportSettings: {}, customAssets: {},
  } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
    'X-CardForge-Provider-Account': 'account-a', 'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64),
  } })));
  mock.onWrite = () => { mock.namespace = 'other-account'; };
  await expect(openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C' })).rejects.toThrow('account changed');
  expect([...mock.values.keys()].every((key) => key.startsWith('test:'))).toBe(true);
  expect(mock.apply).not.toHaveBeenCalled();
});
it('rejects template-only ordinary Open before materializing or persisting bindings', async () => {
  mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document: { cardSets: [] } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
    'X-CardForge-Provider-Account': 'account-a', 'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64),
  } })));
  await expect(openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C' })).rejects.toThrow('no Set');
  expect(mock.values.size).toBe(0);
  expect(mock.apply).not.toHaveBeenCalled();
});

it('preserves the prior binding and warns against repeating a null upload receipt', async () => {
  mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' }))
    .mockResolvedValueOnce(Response.json(null))
    .mockResolvedValueOnce(new Response(null, { status: 404 })));
  await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' })).rejects.toThrow('do not repeat this upload blindly');
  expect(mock.values.get('test:google-drive-work-binding:set-c')).toEqual(driveBinding);
});

it.each([false, true])('initializes a newly saved Set for safe refresh (locally changed: %s)', async (dirty) => {
  const document = { cardSets: [{ id: 'set-c', name: 'C' }], userTemplates: [], storedCards: [], appearanceStyles: [], customAssets: {} };
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C', accountId: 'account-a' }))
    .mockResolvedValueOnce(Response.json({ id: driveBinding.fileId, version: '1', headRevisionId: 'native-1', name: 'C' }));
  vi.stubGlobal('fetch', fetch);
  const saved = await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C', asNew: true });
  expect(mock.makeZip).toHaveBeenCalledOnce();
  mock.makeZip.mockClear();
  expect(saved).toMatchObject({ accountId: 'account-a', workId: 'set-c', portableWorkId: 'set-c', runtimeSetIds: ['set-c'],
    localProjectRevision: 'b'.repeat(64), identities: { set: { 'set-c': 'set-c' } } });
  fetch.mockClear();
  if (dirty) {
    mock.build.mockResolvedValueOnce({ document, manifest: { name: 'C', projectRevision: 'c'.repeat(64), savedAt: '2026-09-05' } });
    await expect(refreshGoogleDriveProject(saved)).rejects.toThrow('browser changes');
    expect(fetch).not.toHaveBeenCalled();
    expect(mock.apply).not.toHaveBeenCalled();
    expect(mock.values.get('test:google-drive-work-binding:set-c')).toEqual(saved);
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    expect(mock.makeZip).not.toHaveBeenCalled();
  } else {
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document });
    fetch.mockResolvedValueOnce(new Response('package', { headers: { 'X-CardForge-Provider-Revision': headToken('2'),
      'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'account-a' } }));
    vi.mocked(window.dispatchEvent).mockImplementation(event => {
      expect(mock.values.get('test:google-drive-work-binding:set-c')).toMatchObject({ providerRevision: headToken('2') });
      expect(event).toMatchObject({ type: GOOGLE_DRIVE_WORKING_COPY_REFRESHED_EVENT, detail: { workId: 'set-c', namespace: 'test' } });
      return true;
    });
    const refreshed = await refreshGoogleDriveProject(saved);
    expect(mock.makeZip).not.toHaveBeenCalled();
    expect(refreshed).toMatchObject({ workId: 'set-c', providerRevision: headToken('2'), identities: saved.identities });
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
    expect(mock.apply).toHaveBeenCalledWith(expect.objectContaining({ cardSets: document.cardSets }), 'merge',
      { expectedState: expect.any(Object), replaceSetIds: ['set-c'] });
  }
});

it('preserves the prior binding when a successful upload omits the native content head', async () => {
  mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' }))
    .mockResolvedValueOnce(Response.json({ id: driveBinding.fileId, version: '2', name: 'C' }))
    .mockResolvedValueOnce(new Response(null, { status: 404 })));
  await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' })).rejects.toThrow('do not repeat this upload blindly');
  expect(mock.values.get('test:google-drive-work-binding:set-c')).toEqual(driveBinding);
});


describe('confirmed Drive save receipts survive browser-link failures', () => {
  const uploadResponse = () => Response.json({
    id: driveBinding.fileId, headRevisionId: 'native-2', name: 'C', modifiedTime: '2026-09-09T00:00:00Z',
  });

  it.each(['set-binding', 'set-pointer', 'workspace-pointer'] as const)(
    'preserves the receipt and source when %s persistence fails', async (failure) => {
      mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
      mock.failWriteKey = failure === 'set-binding'
        ? 'test:google-drive-work-binding:set-c' : 'test:google-drive-project-binding';
      const fetch = vi.fn()
        .mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C', accountId: 'account-a' }))
        .mockResolvedValueOnce(uploadResponse());
      vi.stubGlobal('fetch', fetch);
      const result = await (failure === 'workspace-pointer'
        ? saveCurrentProjectToGoogleDrive({ name: 'C', asNew: true })
        : saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' })).catch((error: unknown) => error);
      expect(result).toBeInstanceOf(GoogleDriveSaveLinkageError);
      if (!(result instanceof GoogleDriveSaveLinkageError)) throw new Error('Expected a confirmed-save receipt');
      expect(result).toMatchObject({
        code: 'source_committed_linkage_refresh_required', sourceCommitted: true, retryable: false,
        sourceReceipt: { fileId: driveBinding.fileId, providerRevision: headToken('2'), projectRevision: 'b'.repeat(64),
          packageScope: failure === 'workspace-pointer' ? 'workspace' : 'set' },
      });
      expect(result.message).toContain('Drive saved the file');
      expect(result.message).toContain('do not repeat the upload');
      expect(result.cause).toBeInstanceOf(Error);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' });
      expect(mock.apply).not.toHaveBeenCalled();
      if (failure === 'set-binding') expect(mock.values.get(mock.failWriteKey)).toEqual(driveBinding);
      else if (failure === 'set-pointer') {
        expect(mock.values.get('test:google-drive-work-binding:set-c')).toMatchObject({ providerRevision: headToken('2') });
        expect(mock.values.has('test:google-drive-project-binding')).toBe(false);
      }
    },
  );

  it('keeps a completed save explicit when the account changes during upload, without writing to the new scope', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' }))
      .mockImplementationOnce(async () => { mock.namespace = 'other-account'; return uploadResponse(); });
    vi.stubGlobal('fetch', fetch);
    const result = await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' }).catch((error: unknown) => error);
    expect(result).toMatchObject({ code: 'source_committed_linkage_refresh_required', sourceCommitted: true,
      retryable: false, sourceReceipt: { fileId: driveBinding.fileId, providerRevision: headToken('2') } });
    expect(mock.values.size).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(mock.apply).not.toHaveBeenCalled();
  });

  it.each([1, 2])('does not report complete local linkage after an account switch at write %i', async (switchAt) => {
    let writes = 0;
    mock.onWrite = () => { if (++writes === switchAt) mock.namespace = 'other-account'; };
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' }))
      .mockResolvedValueOnce(uploadResponse());
    vi.stubGlobal('fetch', fetch);
    const result = await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' }).catch((error: unknown) => error);
    expect(result).toMatchObject({ code: 'source_committed_linkage_refresh_required', sourceCommitted: true,
      retryable: false, sourceReceipt: { fileId: driveBinding.fileId, providerRevision: headToken('2') } });
    expect(writes).toBe(switchAt);
    expect([...mock.values.keys()].every((key) => key.startsWith('test:'))).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(mock.apply).not.toHaveBeenCalled();
  });
});

describe('same-target real transfer ordering and recovery', () => {
  const binding = { ...driveBinding, accountId: 'account-a', localProjectRevision: 'a'.repeat(64) };
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
  };

  it('serializes the autosave and manual entrypoints with an exact, updated provider revision', async () => {
    mock.values.set('test:google-drive-work-binding:set-c', binding);
    mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
    const started = deferred<void>();
    const completed = deferred<Response>();
    const prepares: Array<{ expectedProviderRevision: string }> = [];
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        prepares.push(JSON.parse(options.body as string));
        if (prepares.length === 1) started.resolve();
        return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C', accountId: 'account-a' });
      }
      if (prepares.length === 1) return completed.promise;
      return Response.json({ id: binding.fileId, name: 'C', headRevisionId: 'native-3' });
    });
    vi.stubGlobal('fetch', fetch);
    const autosave = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' });
    await started.promise;
    const manual = saveCurrentProjectToGoogleDrive({ name: 'C' });
    expect(prepares).toHaveLength(1);
    completed.resolve(Response.json({ id: binding.fileId, name: 'C', headRevisionId: 'native-2' }));
    const [first, second] = await Promise.all([autosave, manual]);
    expect(first.providerRevision).toBe(headToken('2'));
    expect(second.providerRevision).toBe(headToken('3'));
    expect(prepares.map((p) => p.expectedProviderRevision)).toEqual(['1', headToken('2')]);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('rebuilds the newest authored checkpoint after the first upload has settled', async () => {
    mock.values.set('test:google-drive-work-binding:set-c', binding);
    mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
    const started = deferred<void>();
    const completed = deferred<Response>();
    const prepares: Array<{ projectRevision: string; expectedProviderRevision: string }> = [];
    let revision = 'b';
    mock.build.mockImplementation(async ({ document, name }: { document: unknown; name: string }) => ({
      document, manifest: { name, projectRevision: revision.repeat(64), savedAt: '2026-10-26' },
    }));
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        prepares.push(JSON.parse(options.body as string));
        if (prepares.length === 1) started.resolve();
        return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C', accountId: 'account-a' });
      }
      if (prepares.length === 1) return completed.promise;
      return Response.json({ id: binding.fileId, name: 'C', headRevisionId: 'native-3' });
    }));
    const autosave = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' });
    await started.promise;
    const manual = saveCurrentProjectToGoogleDrive({ name: 'C' });
    revision = 'c';
    completed.resolve(Response.json({ id: binding.fileId, name: 'C', headRevisionId: 'native-2' }));
    await Promise.all([autosave, manual]);
    expect(prepares).toHaveLength(2);
    expect(prepares[0]).toMatchObject({ projectRevision: 'b'.repeat(64), expectedProviderRevision: '1' });
    expect(prepares[1]).toMatchObject({ projectRevision: 'c'.repeat(64), expectedProviderRevision: headToken('2') });
    expect(await getGoogleDriveProjectBinding()).toMatchObject({ projectRevision: 'c'.repeat(64) });
  });

  it('permits an explicit independent F2 save while retaining F’s unknown outcome', async () => {
    mock.values.set('test:google-drive-work-binding:set-c', binding);
    mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
    const unknown = new GoogleDriveUnknownCommitError();
    await expect(serializeGoogleDriveTargetSave('test', binding, async () => { throw unknown; })).rejects.toBe(unknown);
    const newFile = 'drive-file-independent-F2';
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'F2', accountId: 'account-a' }))
      .mockResolvedValueOnce(Response.json({ id: newFile, name: 'F2', headRevisionId: 'native-5' }));
    vi.stubGlobal('fetch', fetch);
    const saved = await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'F2', asNew: true });
    expect(saved.fileId).toBe(newFile);
    expect(getGoogleDriveSaveBarrier(binding, 'test')).toBe(unknown);
    expect(getGoogleDriveSaveBarrier(saved, 'test')).toBeNull();
    expect((await getGoogleDriveWorkBinding('set-c'))?.fileId).toBe(newFile);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('first-save and destination commitment ordering', () => {
  const settleTurn = async () => { for (let n = 0; n < 20; n++) await new Promise<void>(resolve => setImmediate(resolve)); };
  it('cancels an automatic save during preparation without sending bytes or blocking a later manual save', async () => {
    const controller = new AbortController();
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        controller.abort();
        return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' });
      }
      return Response.json({ id: driveBinding.fileId, headRevisionId: 'native-2', name: 'C' });
    });
    vi.stubGlobal('fetch', fetch);
    await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await getGoogleDriveWorkBinding('set-c')).toBeNull();
    await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' })).resolves.toMatchObject({ fileId: driveBinding.fileId });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('queues concurrent first saves for the same Set', async () => {
    let release!: (response: Response) => void;
    const held = new Promise<Response>(resolve => { release = resolve; });
    const prepares: Array<{ fileId: string | null }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        prepares.push(JSON.parse(options.body as string));
        return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' });
      }
      return held.then(response => response.clone());
    }));
    const first = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' });
    await vi.waitFor(() => expect(prepares).toHaveLength(1));
    const second = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' });
    await settleTurn();
    const beforeRelease = prepares.length;
    release(Response.json({ id: driveBinding.fileId, headRevisionId: 'native-2', name: 'C' }));
    await Promise.all([first, second]);
    expect(beforeRelease).toBe(1);
    expect(prepares[1].fileId).toBe(driveBinding.fileId);
  });
  it('retains an unknown first-save failure before another preparation', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' }))
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    const failure = await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' }).catch(error => error);
    expect(failure).toBeInstanceOf(GoogleDriveUnknownCommitError);
    const calls = fetch.mock.calls.length;
    const retried = await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' }).catch(error => error);
    expect(retried).toBe(failure);
    expect(fetch.mock.calls.length).toBe(calls);
  });
  it('does not let late F overwrite a newer Save as new F2 binding', async () => {
    mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
    let release!: (response: Response) => void;
    const held = new Promise<Response>(resolve => { release = resolve; });
    let posts = 0;
    vi.stubGlobal('fetch',vi.fn(async (url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        const input = JSON.parse(options.body as string);
        posts++;
        return Response.json({ uploadSessionUrl: input.fileId ? 'https://upload.test/F' : 'https://upload.test/F2', name: 'C' });
      }
      if (url.endsWith('/F')) return held;
      return Response.json({ id: 'drive-file-new-F2', headRevisionId: 'native-3', name: 'F2' });
    }));
    const first = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' });
    await vi.waitFor(() => expect(posts).toBe(1));
    const second = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'F2', asNew: true });
    await settleTurn();
    const beforeRelease = posts;
    release(Response.json({ id: driveBinding.fileId, headRevisionId: 'native-2', name: 'C' }));
    await Promise.all([first, second]);
    expect(beforeRelease).toBe(1);
    expect((await getGoogleDriveWorkBinding('set-c'))?.fileId).toBe('drive-file-new-F2');
  });
});


describe('first-save recovery and independence', () => {
  it.each(['test:google-drive-work-binding:set-c', 'test:google-drive-project-binding'])(
    'retains the confirmed first receipt and repairs without PUT after %s fails', async (key) => {
      mock.localSets = [{ id: 'set-c' }];
      mock.failWriteKey = key;
      const fetch = vi.fn()
        .mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C', accountId: 'account-a' }))
        .mockResolvedValueOnce(Response.json({ id: driveBinding.fileId, headRevisionId: 'native-2', name: 'C' }));
      vi.stubGlobal('fetch', fetch);
      const failure = await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' }).catch(error => error);
      expect(failure).toBeInstanceOf(GoogleDriveSaveLinkageError);
      await expect(saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' })).rejects.toBe(failure);
      expect(fetch).toHaveBeenCalledTimes(2);
      mock.failWriteKey = null;
      const receipt = failure.sourceReceipt;
      fetch.mockResolvedValueOnce(Response.json({ connection: { connected: true }, projects: [{
        ...receipt, modifiedAt: receipt.lastSavedAt, size: 7,
      }], nextPageToken: null }));
      const repaired = await repairConfirmedGoogleDriveLink(receipt);
      expect(repaired.fileId).toBe(receipt.fileId);
      expect(getGoogleDriveSaveBarrier(null, 'test', 'set-c')).toBeNull();
      expect(getGoogleDriveSaveBarrier(repaired, 'test', 'set-c')).toBeNull();
      expect(fetch.mock.calls.slice(2)).toHaveLength(1);
      expect(fetch.mock.calls[2][1]).toEqual({ cache: 'no-store' });
    },
  );

  it('allows another Set to finish while the first unbound Set is uploading', async () => {
    let release!: (response: Response) => void;
    const held = new Promise<Response>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => {
      vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
        if (options.method === 'POST') {
          const input = JSON.parse(options.body as string);
          return Response.json({ uploadSessionUrl: `https://upload.test/${input.workId}`, name: 'C' });
        }
        if (url.endsWith('/set-c')) { resolve(); return held; }
        return Response.json({ id: 'drive-file-independent', headRevisionId: 'native-3', name: 'Other' });
      }));
    });
    const first = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' });
    await started;
    try {
      const second = await saveCardSetToGoogleDrive({ setId: 'set-other', name: 'Other' });
      expect(second.fileId).toBe('drive-file-independent');
    } finally {
      release(Response.json({ id: driveBinding.fileId, headRevisionId: 'native-2', name: 'C' }));
      await first;
    }
  });
});


it('serializes exact local receipt repair with Save as new through its binding commit', async () => {
  const receipt = { ...driveBinding, accountId: 'account-a', providerRevision: headToken('2'),
    lastSavedAt: '2026-10-26T00:00:00Z', webViewLink: null, packageScope: 'set' as const };
  mock.localSets = [{ id: 'set-c' }];
  mock.values.set('test:google-drive-work-binding:set-c', receipt);
  let release!: () => void;
  let entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  mock.beforeWrite = async (key) => {
    if (key === 'test:google-drive-work-binding:set-c') {
      mock.beforeWrite = undefined;
      entered();
      await held;
    }
  };
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    if (!options.method) return Response.json({ connection: { connected: true }, projects: [{
      ...receipt, modifiedAt: receipt.lastSavedAt, size: 7,
    }] });
    if (options.method === 'POST') return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'F2' });
    return Response.json({ id: 'drive-file-new-F2', headRevisionId: 'native-3', name: 'F2' });
  });
  vi.stubGlobal('fetch', fetch);
  const repair = repairConfirmedGoogleDriveLink(receipt);
  await started;
  const save = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'F2', asNew: true });
  for (let n = 0; n < 20; n++) await new Promise<void>(resolve => setImmediate(resolve));
  const writesBeforeRelease = fetch.mock.calls.filter(([, options]) => options.method === 'POST').length;
  release();
  await Promise.all([repair, save]);
  expect((await getGoogleDriveWorkBinding('set-c'))?.fileId).toBe('drive-file-new-F2');
  expect(writesBeforeRelease).toBe(0);
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(1);
});


it('rejects Refresh with an old F checkpoint after a queued F2 destination commits', async () => {
  const binding = { ...driveBinding, accountId: 'account-a', identities: {}, packageScope: 'set' as const,
    localProjectRevision: 'b'.repeat(64), lastSavedAt: '2026-10-26T00:00:00Z', webViewLink: null };
  mock.values.set('test:google-drive-work-binding:set-c', binding);
  let release!: (response: Response) => void;
  const held = new Promise<Response>(resolve => { release = resolve; });
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    if (options.method === 'POST') return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'F2' });
    return held;
  });
  vi.stubGlobal('fetch', fetch);
  const save = saveCardSetToGoogleDrive({ setId: 'set-c', name: 'F2', asNew: true });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const refresh = refreshGoogleDriveProject(binding).catch(error => error);
  release(Response.json({ id: 'drive-file-new-F2', headRevisionId: 'native-3', name: 'F2' }));
  await save;
  expect(await refresh).toMatchObject({ message: expect.stringContaining('target changed before refresh') });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(mock.apply).not.toHaveBeenCalled();
  expect((await getGoogleDriveWorkBinding('set-c'))?.fileId).toBe('drive-file-new-F2');
});

it.each(['same Set', 'another Set'] as const)('keeps the new %s binding when deletion of old F finishes after Save as new', async (target) => {
  mock.localSets = [{ id: 'set-c' }, { id: 'set-other' }];
  mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
  mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
  let release!: (response: Response) => void;
  const held = new Promise<Response>(resolve => { release = resolve; });
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    if (options.method === 'DELETE') return held;
    if (options.method === 'POST') return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'F2' });
    return Response.json({ id: 'drive-file-new-F2', headRevisionId: 'native-3', name: 'F2' });
  });
  vi.stubGlobal('fetch', fetch);
  const deletion = deleteGoogleDriveProjectCopy(driveBinding);
  await vi.waitFor(() => expect(fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(true));
  const setId = target === 'same Set' ? 'set-c' : 'set-other';
  const saved = await saveCardSetToGoogleDrive({ setId, name: 'F2', asNew: true });
  release(new Response(null, { status: 204 }));
  await deletion;
  expect(await getGoogleDriveWorkBinding(setId)).toEqual(saved);
  if (target === 'another Set') expect(await getGoogleDriveWorkBinding('set-c')).toBeNull();
  expect(await getGoogleDriveProjectBinding()).toEqual(saved);
  expect(mock.apply).not.toHaveBeenCalled();
});


it('reports a confirmed disconnect separately when browser attachment cleanup fails', async () => {
  mock.localSets = [{ id: 'set-c' }];
  mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
  mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
  mock.failRemoveKey = 'test:google-drive-project-binding';
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ generation: 'a'.repeat(64) })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  await expect(disconnectGoogleDriveStorage()).resolves.toEqual({ attachmentCleanup: 'incomplete' });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: 'set-c' });
  expect(mock.values.get('test:google-drive-work-binding:set-c')).toEqual(driveBinding);
});

it('still rejects a provider disconnect failure before attempting browser cleanup', async () => {
  mock.localSets = [{ id: 'set-c' }];
  mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
  mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ generation: 'a'.repeat(64) })).mockResolvedValueOnce(new Response('unavailable', { status: 503 })));
  await expect(disconnectGoogleDriveStorage()).rejects.toThrow();
  expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: 'set-c' });
});

it.each(['lost response', 'unstructured server error', 'unexpected success response'] as const)('does not invite a revocation retry after %s', async (condition) => {
  mock.localSets = [{ id: 'set-c' }];
  mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
  mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
  const fetch = condition === 'lost response'
    ? vi.fn().mockResolvedValueOnce(Response.json({ generation: 'a'.repeat(64) })).mockRejectedValueOnce(new Error('response lost'))
    : vi.fn().mockResolvedValueOnce(Response.json({ generation: 'a'.repeat(64) })).mockResolvedValueOnce(new Response('unavailable', { status: condition === 'unexpected success response' ? 200 : 503 }));
  vi.stubGlobal('fetch', fetch);
  await expect(disconnectGoogleDriveStorage()).rejects.toMatchObject({
    code: 'google_drive_disconnect_unconfirmed', retryable: false,
    nextAction: expect.stringContaining('Do not'),
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: 'set-c' });
  await expect(disconnectGoogleDriveStorage()).rejects.toMatchObject({ code: 'google_drive_disconnect_unconfirmed', retryable: false });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not contact Google when the browser cannot persist the disconnect review marker', async () => {
  mock.failWriteKey = 'test:google-drive-disconnect-review';
  const fetch = vi.fn().mockResolvedValue(Response.json({ generation: 'a'.repeat(64) })); vi.stubGlobal('fetch', fetch);
  await expect(disconnectGoogleDriveStorage()).rejects.toThrow('Browser storage rejected the binding');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(['same Set', 'another Set'] as const)('keeps a new %s attachment when an earlier provider disconnect completes', async (target) => {
  mock.localSets = [{ id: 'set-c' }, { id: 'set-other' }];
  mock.values.set('test:google-drive-work-binding:set-c', driveBinding);
  mock.values.set('test:google-drive-project-binding', { workId: 'set-c' });
  let release!: (response: Response) => void;
  const held = new Promise<Response>(resolve => { release = resolve; });
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    if (String(_url).includes('disconnect=1')) return Response.json({ generation: 'a'.repeat(64) });
    if (options.method === 'DELETE') return held;
    if (options.method === 'POST') return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'F2' });
    return Response.json({ id: 'drive-file-new-F2', headRevisionId: 'native-3', name: 'F2' });
  });
  vi.stubGlobal('fetch', fetch);
  const disconnect = disconnectGoogleDriveStorage();
  await vi.waitFor(() => expect(fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(true));
  const setId = target === 'same Set' ? 'set-c' : 'set-other';
  const saved = await saveCardSetToGoogleDrive({ setId, name: 'F2', asNew: true });
  release(new Response(null, { status: 204 }));
  await disconnect;
  expect(await getGoogleDriveWorkBinding(setId)).toEqual(saved);
  expect(await getGoogleDriveProjectBinding()).toEqual(saved);
});

it('preserves active A at F2 when Trash removes old F from a legacy multi-Set member B', async () => {
  const document = {
    cardSets: [{ id: 'legacy-a', name: 'A' }, { id: 'legacy-b', name: 'B' }],
    activeCardSetId: 'legacy-a', userTemplates: [], storedCards: [], appearanceStyles: [], customAssets: {},
  };
  mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document });
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (options.method === 'POST') return Response.json({ uploadSessionUrl: 'https://upload.test', name: 'F2', accountId: 'account-a' });
    if (options.method === 'PUT') return Response.json({ id: 'drive-file-new-F2', headRevisionId: 'native-3', name: 'F2' });
    return new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64),
      'X-CardForge-Provider-Account': 'account-a',
    } });
  });
  vi.stubGlobal('fetch', fetch);
  const opened = await openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'Legacy workspace', accountId: 'account-a' });
  const a = opened.workId!;
  const b = opened.runtimeSetIds!.find(id => id !== a)!;
  expect(b).toBeTruthy();
  mock.localSets = opened.runtimeSetIds!.map(id => ({ id }));
  // Observe the actual native Open projection, not a fabricated shared workId.
  expect(await getGoogleDriveWorkBinding(a)).toMatchObject({ fileId: driveBinding.fileId, workId: a });
  expect(await getGoogleDriveWorkBinding(b)).toMatchObject({ fileId: driveBinding.fileId, workId: b });
  const saved = await saveCardSetToGoogleDrive({ setId: a, name: 'F2', asNew: true });
  await deleteGoogleDriveProjectCopy({ fileId: driveBinding.fileId, providerRevision: headToken('1'), projectRevision: 'b'.repeat(64) });
  expect(await getGoogleDriveWorkBinding(a)).toEqual(saved);
  expect(await getGoogleDriveWorkBinding(b)).toBeNull();
  expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: a });
  expect(await getGoogleDriveProjectBinding()).toEqual(saved);
});
