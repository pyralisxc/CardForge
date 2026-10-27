import { createHash } from 'node:crypto';
const headToken = (version: string) => 'head:' + createHash('sha256').update('native-' + version).digest('hex');
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  namespace: 'test',
  beforeWrite: undefined as ((key: string) => Promise<void>) | undefined,
  onWrite: undefined as (() => void) | undefined,
  failWriteKey: null as string | null,
  values: new Map<string, unknown>(),
  localSets: [] as { id: string }[],
  read: vi.fn(),
  captureSet: vi.fn(async (id: string) => ({ cardSets: [{ id, name: 'C' }], userTemplates: [], storedCards: [], appearanceStyles: [], customAssets: {} })),
  captureWorkspace: vi.fn(async () => ({ cardSets: [{ id: 'unrelated' }, { id: 'set-c' }] })),
  decode: vi.fn(),
  apply: vi.fn(async () => ({ activeSetId: 'set-c' })),
  build: vi.fn(async ({ document, name }: { document: unknown; name: string }) => ({ document, manifest: { name, projectRevision: 'b'.repeat(64), savedAt: '2026-09-05' } })),
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
  removeStructuredBrowserValue: async (key: string) => { mock.values.delete(key); },
}));
vi.mock('@/features/project/persistence/projectPersistenceScope', () => ({ getScopedProjectStorageNamespace: () => mock.namespace, getProjectPersistenceScope: () => mock.namespace }));
vi.mock('@/features/project/client/projectWorkspaceDocument', () => ({
  captureCardSetProjectDocument: mock.captureSet,
  captureCurrentProjectDocument: mock.captureWorkspace,
  applyProjectDocumentToWorkspace: mock.apply,
  hasProjectDocumentStateChanged: () => false,
}));
vi.mock('@/features/project/client/browserProjectPackage', () => ({ buildBrowserCardForgeProjectSnapshot: mock.build, decodeBrowserProjectFile: mock.decode }));
vi.mock('@/features/project/client/useProjectBinaryAssetUrl', () => ({ primeProjectBinaryAssetUrls: mock.prime }));
vi.mock('@/features/project/lib/projectPackageCodec', () => ({
  ProjectPackageError: class extends Error {},
  createCardForgeProjectPackageBlob: async () => new Blob(['package']),
  writeCardForgeProjectPackage: async () => {},
  decodeProjectFile: mock.decode,
}));
vi.mock('@/features/analytics/client/tracking', () => ({ observeProviderBoundaryResponse: (_provider: string, _action: string, run: () => unknown) => run() }));
vi.mock('@/features/project/store/workspaceStore', () => {
  const state = { get cardSets() { return mock.localSets; }, storedCards: [] };
  return { useProjectStore: { getState: () => state } };
});

import { resetGoogleDriveTargetSaveStateForTests, serializeGoogleDriveTargetSave, getGoogleDriveSaveBarrier, getGoogleDriveWorkBinding, GoogleDriveUnknownCommitError, GoogleDriveSaveLinkageError, copyGoogleDriveProjectToBrowser, deleteGoogleDriveProjectCopy, getGoogleDriveProjectBinding, openGoogleDriveProject, refreshGoogleDriveProject, saveCardSetToGoogleDrive, saveCurrentProjectToGoogleDrive } from '@/features/project/client/googleDriveProjectTransfer';
import { repairConfirmedGoogleDriveLink } from '@/features/project/client/googleDriveLinkRepair';
import { disconnectLocalProjectFolder, getLocalProjectFolderStatus, saveCardSetToAttachedFolder, saveProjectToAttachedFolder } from '@/features/project/client/localProjectFolder';

const driveBinding = { fileId: 'drive-file-12345', name: 'C', providerRevision: '1', projectRevision: 'a'.repeat(64), workId: 'set-c' };
const folder = (name: string) => {
  const handle = {
    name,
    queryPermission: vi.fn(async () => 'granted'),
    isSameEntry: vi.fn(async (other: { name: string }) => other.name === name),
    getFileHandle: vi.fn(async () => ({ getFile: async () => new Blob(['package']), createWritable: async () => ({ abort: async () => {} }) })),
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
  mock.localSets = [];
  mock.read.mockImplementation(async (key: string) => mock.values.get(key) ?? null);
  mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64) });
  vi.stubGlobal('window', { showDirectoryPicker: vi.fn() });
});

describe('one authoritative Set location across save entry points', () => {
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

  it('refuses refresh of dirty working data before downloading or replacing anything', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(refreshGoogleDriveProject({ ...driveBinding, lastSavedAt: '2026-09-01', webViewLink: null, accountId: 'account-a', packageScope: 'set', identities: {}, localProjectRevision: 'c'.repeat(64) })).rejects.toThrow('browser changes');
    expect(mock.apply).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
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

  it.each([1, 2])('retains explicit package scope when opening a %i-Set historical package', async (count) => {
    const document = { cardSets: Array.from({ length: count }, (_, index) => ({ id: `old-${index}` })), userTemplates: [], storedCards: [], appearanceStyles: [], customAssets: {} };
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('package', { headers: {
      'X-CardForge-Provider-Revision': headToken('1'), 'X-CardForge-Project-Revision': 'b'.repeat(64),
      'X-CardForge-Provider-Account': 'google-account-1',
    } })));
    const binding = await openGoogleDriveProject({ fileId: driveBinding.fileId, name: 'C' });
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
    await saveCardSetToGoogleDrive({ setId: 'set-c', name: 'C' });
    await saveCurrentProjectToGoogleDrive({ name: 'C' });
    expect(mock.captureWorkspace).not.toHaveBeenCalled();
    expect(mock.captureSet).toHaveBeenCalledTimes(3);
    expect(renderThumbnail).toHaveBeenCalledWith(expect.objectContaining({ cardSets: [{ id: 'set-c', name: 'C' }] }));
    expect(prepare[0]).toMatchObject({ thumbnail: 'canonical-preview' });
    expect(prepare.map((value) => [value.fileId, value.workId, value.expectedProviderRevision])).toEqual([
      [driveBinding.fileId, 'set-c', '1'], [driveBinding.fileId, 'set-c', headToken('2')], [driveBinding.fileId, 'set-c', headToken('3')],
    ]);
    expect(mock.values.get('test:google-drive-project-binding')).toEqual({ workId: 'set-c' });
    expect(await getGoogleDriveProjectBinding()).toMatchObject({ providerRevision: headToken('4') });
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

  it('preserves verified workspace backup saves', async () => {
    const handle = folder('backup');
    mock.values.set('test:local-project-folder-binding', { handle, folderName: 'backup', sourceRevision: 'b'.repeat(64), packageScope: 'workspace' });
    await saveProjectToAttachedFolder();
    expect(mock.captureWorkspace).toHaveBeenCalledOnce();
    expect(mock.captureSet).not.toHaveBeenCalled();
  });
});

describe('location failure and detach safety', () => {
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
  expect(saved).toMatchObject({ accountId: 'account-a', workId: 'set-c', portableWorkId: 'set-c', runtimeSetIds: ['set-c'],
    localProjectRevision: 'b'.repeat(64), identities: { set: { 'set-c': 'set-c' } } });
  fetch.mockClear();
  if (dirty) {
    mock.build.mockResolvedValueOnce({ document, manifest: { name: 'C', projectRevision: 'c'.repeat(64), savedAt: '2026-09-05' } });
    await expect(refreshGoogleDriveProject(saved)).rejects.toThrow('browser changes');
    expect(fetch).not.toHaveBeenCalled();
    expect(mock.apply).not.toHaveBeenCalled();
    expect(mock.values.get('test:google-drive-work-binding:set-c')).toEqual(saved);
  } else {
    mock.decode.mockResolvedValue({ format: 'cardforge-package', sourceRevision: 'b'.repeat(64), document });
    fetch.mockResolvedValueOnce(new Response('package', { headers: { 'X-CardForge-Provider-Revision': headToken('2'),
      'X-CardForge-Project-Revision': 'b'.repeat(64), 'X-CardForge-Provider-Account': 'account-a' } }));
    const refreshed = await refreshGoogleDriveProject(saved);
    expect(refreshed).toMatchObject({ workId: 'set-c', providerRevision: headToken('2'), identities: saved.identities });
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
