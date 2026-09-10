import { createHash } from 'node:crypto';
const headToken = (version: string) => 'head:' + createHash('sha256').update('native-' + version).digest('hex');
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  namespace: 'test',
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
}));
vi.mock('@/features/project/persistence/structuredBrowserStorage', () => ({
  readStructuredBrowserValue: mock.read,
  writeStructuredBrowserValue: async (key: string, value: unknown) => {
    if (key === mock.failWriteKey) throw new Error('Browser storage rejected the binding');
    mock.values.set(key, value);
    mock.onWrite?.();
  },
  removeStructuredBrowserValue: async (key: string) => { mock.values.delete(key); },
}));
vi.mock('@/features/project/persistence/projectPersistenceScope', () => ({ getScopedProjectStorageNamespace: () => mock.namespace }));
vi.mock('@/features/project/client/projectWorkspaceDocument', () => ({
  captureCardSetProjectDocument: mock.captureSet,
  captureCurrentProjectDocument: mock.captureWorkspace,
  applyProjectDocumentToWorkspace: mock.apply,
}));
vi.mock('@/features/project/client/browserProjectPackage', () => ({ buildBrowserCardForgeProjectSnapshot: mock.build, decodeBrowserProjectFile: mock.decode }));
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

import { GoogleDriveSaveLinkageError, copyGoogleDriveProjectToBrowser, deleteGoogleDriveProjectCopy, getGoogleDriveProjectBinding, openGoogleDriveProject, refreshGoogleDriveProject, saveCardSetToGoogleDrive, saveCurrentProjectToGoogleDrive } from '@/features/project/client/googleDriveProjectTransfer';
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
  vi.clearAllMocks();
  mock.values.clear();
  mock.namespace = 'test';
  mock.onWrite = undefined;
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
    expect(mock.apply).toHaveBeenCalledWith(expect.objectContaining({ cardSets: expect.any(Array) }), 'merge', expect.objectContaining({ expectedState: expect.any(Object) }));
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

  it('clears only matching local bindings after the exact Drive file is deleted', async () => {
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

  it('does not delete a Drive file when local attachment metadata cannot be read', async () => {
    mock.read.mockRejectedValue(new Error('Storage unavailable'));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(deleteGoogleDriveProjectCopy({ fileId: driveBinding.fileId, providerRevision: '1', projectRevision: driveBinding.projectRevision })).rejects.toThrow('Storage unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retains local bindings if the Drive deletion fails', async () => {
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' })).mockResolvedValueOnce(Response.json(null)));
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ uploadSessionUrl: 'https://upload.test', name: 'C' }))
    .mockResolvedValueOnce(Response.json({ id: driveBinding.fileId, version: '2', name: 'C' })));
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
